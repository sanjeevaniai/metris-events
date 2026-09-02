import { beforeEach, describe, expect, mock, test } from "bun:test";

/* Checkout: price validation, capacity enforcement, and the
   reserve-or-expire lifecycle. Stripe and the store are both mocked. */

type Calls = {
  created: unknown[];
  expired: string[];
  reserved: unknown[];
  released: unknown[];
};

async function callCheckout(opts: {
  body?: Record<string, unknown>;
  price?: { active?: boolean; unit_amount?: number; currency?: string };
  used?: { ok: true; reserved: number; paid: number } | { ok: false; error: string };
  reserve?: unknown;
  createThrows?: boolean;
}) {
  const calls: Calls = { created: [], expired: [], reserved: [], released: [] };

  const store = {
    usedCapacity: async () => opts.used ?? { ok: true, reserved: 0, paid: 0 },
    reserveSeats: async (input: unknown) => {
      calls.reserved.push(input);
      return opts.reserve ?? { ok: true, granted: true, remaining: 449 };
    },
    releaseReservation: async (input: unknown) => {
      calls.released.push(input);
      return { ok: true };
    },
  };

  mock.module("../../server/persistence", () => ({
    getStore: () => store,
    eventId: () => "metris-exec-2026-10-14",
  }));
  mock.module("../../server/stripe", () => ({
    hasStripeKey: () => true,
    stripe: () => ({
      prices: {
        retrieve: async () => ({
          active: opts.price?.active ?? true,
          unit_amount: opts.price?.unit_amount ?? 24900,
          currency: opts.price?.currency ?? "usd",
        }),
      },
      checkout: {
        sessions: {
          create: async (args: unknown) => {
            if (opts.createThrows) throw new Error("stripe is down");
            calls.created.push(args);
            return { id: "cs_test_new", url: "https://checkout.stripe.test/pay/cs_test_new" };
          },
          expire: async (id: string) => {
            calls.expired.push(id);
            return { id };
          },
        },
      },
    }),
    json: (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s }),
    trim: (v: unknown, max = 480) => {
      const s = String(v ?? "").trim();
      return s.length > max ? s.slice(0, max - 3) + "..." : s;
    },
    EMAIL_RE: /^[^@\s]+@[^@\s]+\.[^@\s]+$/,
  }));

  const { Route } = await import("./checkout");
  const handler = (
    Route as unknown as {
      options: {
        server: { handlers: Record<string, (c: { request: Request }) => Promise<Response>> };
      };
    }
  ).options.server.handlers["POST"]!;

  const res = await handler({
    request: new Request("https://x/api/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        registrationId: "reg_abc",
        passId: "executive",
        email: "jane@bigcarehealth.com",
        ...(opts.body ?? {}),
      }),
    }),
  });
  return { res, json: (await res.json()) as Record<string, unknown>, calls };
}

beforeEach(() => {
  process.env["STRIPE_PRICE_EXECUTIVE"] = "price_exec";
  process.env["STRIPE_PRICE_TEAM"] = "price_team";
  process.env["PUBLIC_SITE_URL"] = "https://events.sanjeevaniai.com";
  delete process.env["ORGANIZATION_KEY_OVERRIDES"];
});

describe("price validation", () => {
  test("a correct price proceeds and returns the checkout URL", async () => {
    const { res, json } = await callCheckout({});
    expect(res.status).toBe(200);
    expect(String(json["url"])).toContain("checkout.stripe.test");
  });

  test("a price mismatch is refused and no session is created", async () => {
    const { res, json, calls } = await callCheckout({ price: { unit_amount: 19900 } });
    expect(res.status).toBe(500);
    expect(String(json["error"])).toContain("Refusing to charge a different amount");
    expect(calls.created.length).toBe(0);
  });

  test("a currency mismatch is refused", async () => {
    const { res } = await callCheckout({ price: { currency: "eur" } });
    expect(res.status).toBe(500);
  });

  test("an archived price is refused", async () => {
    const { res, json } = await callCheckout({ price: { active: false } });
    expect(res.status).toBe(500);
    expect(String(json["error"])).toContain("archived");
  });

  test("a missing price env var is refused by name", async () => {
    delete process.env["STRIPE_PRICE_TEAM"];
    const { res, json } = await callCheckout({ body: { passId: "team" } });
    expect(res.status).toBe(500);
    expect(String(json["error"])).toContain("STRIPE_PRICE_TEAM");
  });

  test("the Team Pass is validated against 112500, not 24900", async () => {
    const { res } = await callCheckout({
      body: { passId: "team" },
      price: { unit_amount: 112500 },
    });
    expect(res.status).toBe(200);
  });

  test("the client cannot supply its own price, currency or seat count", async () => {
    const { res, calls } = await callCheckout({
      body: { price: 1, currency: "eur", places: 500, amount: 1 },
    });
    expect(res.status).toBe(200);
    const created = calls.created[0] as Record<string, unknown>;
    /* the line item is the server's price id; the client's fields are ignored */
    expect(created["line_items"]).toEqual([{ price: "price_exec", quantity: 1 }]);
    expect((created["metadata"] as Record<string, string>)["places"]).toBe("1");
  });
});

describe("capacity enforcement", () => {
  test("Executive reserves 1 place", async () => {
    const { calls } = await callCheckout({});
    expect((calls.reserved[0] as Record<string, number>)["places"]).toBe(1);
  });

  test("Team reserves 5 places", async () => {
    const { calls } = await callCheckout({
      body: { passId: "team" },
      price: { unit_amount: 112500 },
    });
    expect((calls.reserved[0] as Record<string, number>)["places"]).toBe(5);
  });

  test("sold out: no Stripe session is created at all", async () => {
    const { res, json, calls } = await callCheckout({
      used: { ok: true, reserved: 0, paid: 450 },
    });
    expect(res.status).toBe(409);
    expect(json["soldOut"]).toBe(true);
    expect(calls.created.length).toBe(0);
  });

  test("four places left: Team refused, Executive still allowed", async () => {
    const used = { ok: true as const, reserved: 0, paid: 446 };
    const team = await callCheckout({
      body: { passId: "team" },
      price: { unit_amount: 112500 },
      used,
    });
    expect(team.res.status).toBe(409);
    expect(team.json["executiveAvailable"]).toBe(true);

    const exec = await callCheckout({ used });
    expect(exec.res.status).toBe(200);
  });

  test("losing the race: the created session is EXPIRED, not left payable", async () => {
    const { res, json, calls } = await callCheckout({
      reserve: { ok: true, granted: false, remaining: 0, reason: "sold out" },
    });
    expect(res.status).toBe(409);
    expect(json["soldOut"]).toBe(true);
    /* the crucial part: an unusable session must not stay open */
    expect(calls.expired).toEqual(["cs_test_new"]);
  });

  test("a reservation error also expires the session and takes no payment", async () => {
    const { res, calls } = await callCheckout({
      reserve: { ok: false, error: "sheet unreachable" },
    });
    expect(res.status).toBe(503);
    expect(calls.expired).toEqual(["cs_test_new"]);
  });

  test("if capacity cannot be established, no payment is taken", async () => {
    const { res, json, calls } = await callCheckout({
      used: { ok: false, error: "sheet unreachable" },
    });
    expect(res.status).toBe(503);
    expect(calls.created.length).toBe(0);
    expect(String(json["error"])).toContain("Nothing has been charged");
  });
});

describe("identity gate", () => {
  test("a consumer address cannot reach payment, even posting directly", async () => {
    const { res, json, calls } = await callCheckout({ body: { email: "jane@gmail.com" } });
    expect(res.status).toBe(403);
    expect(json["needsReview"]).toBe(true);
    expect(calls.created.length).toBe(0);
  });

  test("a registration id is required to attach the payment to", async () => {
    const { res } = await callCheckout({ body: { registrationId: "" } });
    expect(res.status).toBe(400);
  });
});

describe("session shape", () => {
  test("a 30-minute expiry is set, and the reservation matches it", async () => {
    const { calls } = await callCheckout({});
    const created = calls.created[0] as Record<string, number>;
    const secondsAway = created["expires_at"]! - Math.floor(Date.now() / 1000);
    expect(secondsAway).toBeGreaterThan(29 * 60);
    expect(secondsAway).toBeLessThanOrEqual(30 * 60);
  });

  test("success and cancel URLs point back at the one page", async () => {
    const { calls } = await callCheckout({});
    const created = calls.created[0] as Record<string, string>;
    expect(created["success_url"]).toContain("status=success");
    expect(created["success_url"]).toContain("{CHECKOUT_SESSION_ID}");
    expect(created["cancel_url"]).toContain("status=cancelled");
  });

  test("the organization key rides on the session for the entitlement claim", async () => {
    const { calls } = await callCheckout({});
    const created = calls.created[0] as Record<string, Record<string, string>>;
    expect(created["metadata"]!["organizationKey"]).toBe("bigcarehealth.com");
  });
});
