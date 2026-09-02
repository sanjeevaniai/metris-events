import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { sheetStore } from "./persistence-sheet";

/* The Apps Script transport. Every call is mocked: no request leaves the
   process and no row is written to any real sheet. */

const realFetch = globalThis.fetch;
let calls: Array<Record<string, unknown>> = [];

function reply(body: unknown, status = 200) {
  globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
    if (init?.body) calls.push(JSON.parse(String(init.body)) as Record<string, unknown>);
    return new Response(typeof body === "string" ? body : JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;
}

/* Apps Script answers a POST with a 302 whose target carries the real JSON. */
function replyViaRedirect(body: unknown) {
  let hop = 0;
  globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
    if (init?.body) calls.push(JSON.parse(String(init.body)) as Record<string, unknown>);
    hop += 1;
    if (hop === 1) {
      return new Response("", {
        status: 302,
        headers: { location: "https://redirected.example/x" },
      });
    }
    return new Response(JSON.stringify(body), { status: 200 });
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  calls = [];
  process.env["SHEET_WEBHOOK_URL"] = "https://script.example/exec";
  process.env["SHEET_SHARED_SECRET"] = "test-secret";
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("transport", () => {
  test("refuses by name when the sheet URL is not configured", async () => {
    delete process.env["SHEET_WEBHOOK_URL"];
    const r = await sheetStore().usedCapacity();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("SHEET_WEBHOOK_URL");
  });

  test("the shared secret is sent, and never the other way round", async () => {
    reply({ ok: true, reserved: 0, paid: 0 });
    await sheetStore().usedCapacity();
    expect(calls[0]?.["secret"]).toBe("test-secret");
  });

  test("follows the Apps Script 302 and reads the real answer", async () => {
    replyViaRedirect({ ok: true, reserved: 7, paid: 3 });
    const r = await sheetStore().usedCapacity();
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.reserved).toBe(7);
      expect(r.paid).toBe(3);
    }
  });

  test("a sign-in HTML page is a failure, not a success", async () => {
    reply("<!DOCTYPE html><html>Sign in</html>");
    const r = await sheetStore().usedCapacity();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("Anyone");
  });

  test("an unreadable reply is a FAILURE — never an assumed success", async () => {
    /* This is the property that keeps capacity honest: "I could not read the
       answer" must never become "you have the seat". */
    reply("not json at all");
    const r = await sheetStore().reserveSeats({
      registrationId: "reg_1",
      stripeSessionId: "cs_1",
      places: 5,
      expiresAt: new Date().toISOString(),
    });
    expect(r.ok).toBe(false);
  });

  test("an empty reply is a failure", async () => {
    reply("");
    expect((await sheetStore().usedCapacity()).ok).toBe(false);
  });

  test("a sheet-side rejection is surfaced with its reason", async () => {
    reply({ ok: false, error: "bad secret" });
    const r = await sheetStore().usedCapacity();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("bad secret");
  });
});

describe("reservations", () => {
  test("a grant is reported as granted", async () => {
    reply({ ok: true, granted: true, remaining: 444 });
    const r = await sheetStore().reserveSeats({
      registrationId: "reg_1",
      stripeSessionId: "cs_1",
      places: 5,
      expiresAt: new Date().toISOString(),
    });
    expect(r.ok && r.granted).toBe(true);
  });

  test("sold out is a normal answer, not an error", async () => {
    reply({ ok: true, granted: false, remaining: 2, reason: "not enough saleable places remain" });
    const r = await sheetStore().reserveSeats({
      registrationId: "reg_1",
      stripeSessionId: "cs_1",
      places: 5,
      expiresAt: new Date().toISOString(),
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.granted).toBe(false);
      expect(r.remaining).toBe(2);
    }
  });

  test("capacity travels with the request, so config stays the one source", async () => {
    reply({ ok: true, granted: true, remaining: 1 });
    await sheetStore().reserveSeats({
      registrationId: "reg_1",
      stripeSessionId: "cs_1",
      places: 1,
      expiresAt: new Date().toISOString(),
    });
    expect(calls[0]?.["capacity"]).toBe(450);
  });

  test("a reservation with no acknowledgement holds no place", async () => {
    reply({ ok: true });
    const r = await sheetStore().reserveSeats({
      registrationId: "reg_1",
      stripeSessionId: "cs_1",
      places: 1,
      expiresAt: new Date().toISOString(),
    });
    expect(r.ok).toBe(false);
  });

  test("refusing to release a paid allocation is reported as success", async () => {
    /* The store protecting a paid seat is correct behaviour, not a failure. */
    reply({ ok: true, released: false, reason: "allocation is paid; refusing to release" });
    const r = await sheetStore().releaseReservation({
      stripeSessionId: "cs_1",
      reason: "checkout_expired",
    });
    expect(r.ok).toBe(true);
  });
});

describe("atomic claims", () => {
  test("first caller is told to do the work", async () => {
    reply({ ok: true, alreadyDone: false });
    const c = await sheetStore().claimStripeEvent("evt_1", "checkout.session.completed");
    expect(c.ok && c.alreadyDone).toBe(false);
  });

  test("a replay is told the work is already done", async () => {
    reply({ ok: true, alreadyDone: true });
    const c = await sheetStore().claimStripeEvent("evt_1", "checkout.session.completed");
    expect(c.ok && c.alreadyDone).toBe(true);
  });

  test("an unacknowledged claim is unsafe and refuses", async () => {
    reply({ ok: true });
    const c = await sheetStore().claimEmailSend("reg_1");
    expect(c.ok).toBe(false);
    if (!c.ok) expect(c.error).toContain("not safe");
  });

  test("entitlement claim is keyed on the organization", async () => {
    reply({ ok: true, alreadyDone: false });
    await sheetStore().claimEntitlement({ organizationKey: "acme.com", registrationId: "reg_1" });
    expect(calls[0]?.["organizationKey"]).toBe("acme.com");
    expect(calls[0]?.["action"]).toBe("claimEntitlement");
  });
});
