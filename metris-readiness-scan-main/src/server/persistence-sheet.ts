import "@tanstack/react-start/server-only";

import { eventConfig } from "../config/event";
import {
  eventId,
  type Attendee,
  type Claim,
  type Registration,
  type RegistrationStore,
  type ReservationResult,
  type StoreResult,
  type UsedCapacity,
} from "./persistence";

/* The Google Sheet implementation, talking to the Apps Script web app.

   THE 302 TRAP, which is why redirects are handled by hand: Apps Script
   answers a POST with a 302. Node's fetch follows it by turning the POST into
   a GET, dropping the body, and the GET then returns 200 whatever happened —
   so a failed write looks like a success. Following the redirect deliberately
   with a GET is a different thing and is correct: doPost has already run by
   the time the redirect is issued, so the GET only collects the answer.

   Without this, reserveSeats cannot tell "granted" from "sold out", and every
   atomic claim in this file becomes a coin flip. */

const REDIRECTS = [301, 302, 303, 307, 308];
const TIMEOUT_MS = 12_000;

type Payload = Record<string, unknown>;
type Reply = { ok: boolean; error?: string; body?: Record<string, unknown> };

async function post(payload: Payload): Promise<Reply> {
  const url = String(process.env["SHEET_WEBHOOK_URL"] ?? "").trim();
  if (!url) {
    return {
      ok: false,
      error: "SHEET_WEBHOOK_URL is not set on the server, so there is nowhere to record this.",
    };
  }

  const body: Payload = { ...payload, eventId: eventId() };
  const secret = String(process.env["SHEET_SHARED_SECRET"] ?? "").trim();
  if (secret) body["secret"] = secret;

  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      redirect: "manual",
      signal: stop.signal,
    });
  } catch (e) {
    const err = e as Error;
    return {
      ok: false,
      error:
        err?.name === "AbortError"
          ? `The sheet did not answer within ${TIMEOUT_MS / 1000} seconds.`
          : `Could not reach the sheet: ${err?.message ?? String(e)}`,
    };
  } finally {
    clearTimeout(timer);
  }

  if (REDIRECTS.includes(res.status)) {
    const location = res.headers.get("location");
    if (!location) {
      return {
        ok: false,
        error: "The sheet redirected without a location, so its answer is lost.",
      };
    }
    let follow: Response;
    try {
      follow = await fetch(location, { redirect: "follow" });
    } catch (e) {
      return { ok: false, error: `Could not read the sheet's reply: ${(e as Error)?.message}` };
    }
    return parse(await follow.text().catch(() => ""));
  }

  const text = await res.text().catch(() => "");

  if (res.status === 200) {
    if (/^\s*</.test(text) || /<!DOCTYPE/i.test(text)) {
      return {
        ok: false,
        error:
          "The sheet returned a web page instead of a result, which usually means the " +
          "Apps Script deployment is not set to 'Anyone'. Nothing was recorded.",
      };
    }
    return parse(text);
  }

  return {
    ok: false,
    error:
      `The sheet answered ${res.status} ${res.statusText || ""}` +
      (text ? `: ${text.slice(0, 300)}` : "") +
      ". Nothing was recorded.",
  };
}

/* An unparseable reply is a FAILURE, not a success.

   The previous version treated "not JSON" as ok, on the grounds that the write
   probably ran. That is survivable for a fire-and-forget log line and fatal for
   a capacity system: "I could not read the answer" would become "you have the
   seat". Every caller below depends on an actual acknowledgement. */
function parse(text: string): Reply {
  if (!text.trim()) {
    return { ok: false, error: "The sheet returned an empty reply, so nothing can be confirmed." };
  }
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    if (parsed["ok"] === false) {
      return {
        ok: false,
        error: `The sheet rejected it: ${String(parsed["error"] ?? "no reason")}.`,
      };
    }
    return { ok: true, body: parsed };
  } catch {
    return {
      ok: false,
      error: `The sheet's reply was not JSON, so nothing can be confirmed: ${text.slice(0, 200)}`,
    };
  }
}

/* A claim is only real if the script actually answered it. Treating "no
   answer" as "not yet done" would let a Stripe retry send a second email or
   take a second seat. */
function asClaim(r: Reply): Claim {
  if (!r.ok) return { ok: false, error: r.error ?? "unknown sheet error" };
  const done = r.body?.["alreadyDone"];
  if (typeof done !== "boolean") {
    return {
      ok: false,
      error: "The sheet did not answer the claim, so it is not safe to proceed.",
    };
  }
  return { ok: true, alreadyDone: done };
}

function asResult(r: Reply): StoreResult {
  return r.ok ? { ok: true } : { ok: false, error: r.error ?? "unknown sheet error" };
}

export function sheetStore(): RegistrationStore {
  return {
    async saveRegistration(row: Registration): Promise<StoreResult> {
      return asResult(await post({ action: "saveRegistration", row }));
    },

    async reserveSeats(input): Promise<ReservationResult> {
      const r = await post({
        action: "reserveSeats",
        registrationId: input.registrationId,
        stripeSessionId: input.stripeSessionId,
        places: input.places,
        expiresAt: input.expiresAt,
        /* capacity travels with the request so eventConfig stays the single
           source of truth and the script does not hold a second copy */
        capacity: eventConfig.publicSaleableCapacity,
      });
      if (!r.ok) return { ok: false, error: r.error ?? "unknown sheet error" };

      const granted = r.body?.["granted"];
      if (typeof granted !== "boolean") {
        return {
          ok: false,
          error: "The sheet did not answer the reservation, so no place can be held.",
        };
      }
      const remaining = Number(r.body?.["remaining"] ?? 0);
      return granted
        ? { ok: true, granted: true, remaining }
        : {
            ok: true,
            granted: false,
            remaining,
            reason: String(r.body?.["reason"] ?? "not enough saleable places remain"),
          };
    },

    async markPaid(input): Promise<StoreResult> {
      return asResult(
        await post({
          action: "markPaid",
          registrationId: input.registrationId,
          stripeSessionId: input.stripeSessionId,
          stripePaymentIntentId: input.stripePaymentIntentId,
          amount: input.amount,
          currency: input.currency,
          paidAt: input.paidAt,
          capacity: eventConfig.publicSaleableCapacity,
        }),
      );
    },

    async releaseReservation(input): Promise<StoreResult> {
      const r = await post({
        action: "releaseReservation",
        stripeSessionId: input.stripeSessionId,
        reason: input.reason,
      });
      if (!r.ok) return { ok: false, error: r.error ?? "unknown sheet error" };
      /* `released:false` on a paid allocation is the correct, protective
         answer and is reported as success — nothing was wrongly freed. */
      return { ok: true };
    },

    async usedCapacity(): Promise<UsedCapacity> {
      const r = await post({ action: "usedCapacity" });
      if (!r.ok) return { ok: false, error: r.error ?? "unknown sheet error" };
      const reserved = r.body?.["reserved"];
      const paid = r.body?.["paid"];
      if (typeof reserved !== "number" || typeof paid !== "number") {
        return { ok: false, error: "The sheet did not report capacity." };
      }
      return { ok: true, reserved, paid };
    },

    async saveAttendees(rows: Attendee[]): Promise<StoreResult> {
      return asResult(await post({ action: "saveAttendees", rows }));
    },

    async claimStripeEvent(id, type): Promise<Claim> {
      return asClaim(
        await post({ action: "claimStripeEvent", stripeEventId: id, eventType: type }),
      );
    },
    async releaseStripeEvent(id): Promise<StoreResult> {
      return asResult(await post({ action: "releaseStripeEvent", stripeEventId: id }));
    },

    async claimEmailSend(registrationId): Promise<Claim> {
      return asClaim(await post({ action: "claimEmail", registrationId }));
    },
    async releaseEmailClaim(registrationId): Promise<StoreResult> {
      return asResult(await post({ action: "releaseEmail", registrationId }));
    },

    async claimEntitlement(input): Promise<Claim> {
      return asClaim(await post({ action: "claimEntitlement", ...input }));
    },
  };
}
