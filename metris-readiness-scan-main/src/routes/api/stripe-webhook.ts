import { createFileRoute } from "@tanstack/react-router";
import type Stripe from "stripe";

import { alertFailedWrite } from "../../server/alerts";
import { sendConfirmation } from "../../server/email";
import { expectedCurrency, expectedUnitAmount, isPassId } from "../../server/passes";
import { eventId, getStore } from "../../server/persistence";
import { hasStripeKey, stripe } from "../../server/stripe";

/* Stripe calls this when a payment finishes, expires or fails. It is the ONLY
   thing that may mark a registration paid.

   ORDERING — CHANGED, DELIBERATELY.
   ---------------------------------
   The previous version verified the signature, answered 200, and only then
   wrote, so that a slow Apps Script could never make Stripe mark the endpoint
   unhealthy. That trade is no longer acceptable. This handler now runs on
   Cloudflare Workers, where a promise that is not awaited before the response
   may simply never run — and the write it was dropping is now the one that
   converts a reserved place into a paid one. A dropped write there either
   silently shrinks inventory forever, or, once a sweeper releases the stale
   reservation, resells a place somebody has already paid for.

   So: NOTHING IS ACKNOWLEDGED UNTIL IT IS DURABLY RECORDED. If the essential
   write fails, this answers 5xx and Stripe retries with backoff for days.
   Stripe's retry queue is now the durability mechanism, which is what it is
   for. The cost is that a broken sheet shows up as a failing endpoint in the
   Stripe dashboard — which is the correct, visible outcome.

   IDEMPOTENCY. Every delivery claims the Stripe event id first, atomically.
   The first caller does the work; every replay is told the event is already
   handled and returns 200 without touching anything. If the work then fails,
   the claim is released so the retry can genuinely retry.

   ORDER. Stripe does not guarantee delivery order. An expiry event can arrive
   after the completion event for the same session. The store refuses to
   release a paid allocation, so out-of-order delivery cannot resell a seat.

   DELAYED PAYMENT METHODS. This Checkout configuration is CARDS ONLY, so
   checkout.session.async_payment_succeeded and async_payment_failed cannot
   occur and are deliberately not handled. If a delayed method (bank debit,
   BNPL) is ever enabled in the Stripe dashboard, those two events MUST be
   added here — until then a session would complete unpaid and this handler
   would mark it paid.

   In the Stripe dashboard: Developers > Webhooks > Add endpoint
     URL:    https://<domain>/api/stripe-webhook
     Events: checkout.session.completed
             checkout.session.expired
             charge.refunded */

function ok(body: Record<string, unknown> = { received: true }): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

/* A 5xx tells Stripe to retry. Used for every failure that is ours rather than
   the caller's — an unreachable sheet, a refused write, a lost acknowledgement. */
function retryable(reason: string): Response {
  return new Response(JSON.stringify({ error: reason }), {
    status: 503,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

/* Everything the completion path must establish before it believes a payment.
   The session id in the event is not enough: this re-reads the session from
   Stripe and checks the money, so a forged or stale payload cannot mark a row
   paid even if it somehow passed signature verification. */
async function verifiedPayment(
  s: Stripe.Checkout.Session,
): Promise<
  | { ok: true; passId: "executive" | "team"; amount: string; currency: string }
  | { ok: false; error: string }
> {
  if (s.payment_status !== "paid") {
    return { ok: false, error: `payment_status is "${s.payment_status}", not "paid"` };
  }

  const passId = s.metadata?.["passId"] ?? "";
  if (!isPassId(passId)) {
    return { ok: false, error: `session carries no recognizable pass id ("${passId}")` };
  }

  /* The amount and currency must be exactly what this pass advertises. A
     session for the right product at the wrong price is not a valid purchase. */
  const amountMinor = s.amount_total ?? 0;
  const currency = (s.currency ?? "").toLowerCase();
  if (amountMinor !== expectedUnitAmount(passId) || currency !== expectedCurrency(passId)) {
    return {
      ok: false,
      error:
        `session paid ${(amountMinor / 100).toFixed(2)} ${currency.toUpperCase()}, ` +
        `but the ${passId} pass is ${(expectedUnitAmount(passId) / 100).toFixed(2)} ` +
        `${expectedCurrency(passId).toUpperCase()}`,
    };
  }

  return {
    ok: true,
    passId,
    amount: (amountMinor / 100).toFixed(2),
    currency: currency.toUpperCase(),
  };
}

export const Route = createFileRoute("/api/stripe-webhook")({
  server: {
    handlers: {
      ANY: () =>
        new Response("Method not allowed. Use POST.", {
          status: 405,
          headers: { allow: "POST" },
        }),
      POST: async ({ request }) => {
        if (!hasStripeKey() || !String(process.env["STRIPE_WEBHOOK_SECRET"] ?? "").trim()) {
          return new Response("STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET is not set.", {
            status: 500,
          });
        }

        /* Stripe signs the raw bytes, so the body must not be parsed or
           re-encoded before the signature is checked. */
        const raw = await request.text();
        const signature = request.headers.get("stripe-signature") ?? "";

        let event: Stripe.Event;
        try {
          event = await stripe().webhooks.constructEventAsync(
            raw,
            signature,
            String(process.env["STRIPE_WEBHOOK_SECRET"]),
          );
        } catch (e) {
          /* 400, never a retry: this will never verify, and it means the
             request did not come from Stripe. */
          return new Response(`Signature check failed: ${(e as Error)?.message ?? ""}`, {
            status: 400,
          });
        }

        const store = getStore();

        /* Events we do not act on are acknowledged without being claimed, so
           the claim table stays a record of work actually done. */
        const HANDLED = [
          "checkout.session.completed",
          "checkout.session.expired",
          "charge.refunded",
        ];
        if (!HANDLED.includes(event.type)) return ok({ ignored: event.type });

        /* ATOMIC. Exactly one delivery of this event id does the work. */
        const claim = await store.claimStripeEvent(event.id, event.type);
        if (!claim.ok) {
          /* The claim could not be established, so doing the work might
             duplicate it. Ask Stripe to come back. */
          return retryable(`could not claim event ${event.id}: ${claim.error}`);
        }
        if (claim.alreadyDone) {
          return ok({ received: true, duplicate: true, id: event.id });
        }

        try {
          const result = await handle(event, store);
          if (!result.ok) {
            /* Give the claim back so the retry is a real retry rather than
               being told the event was already handled. */
            await store.releaseStripeEvent(event.id);
            await alertFailedWrite({
              what: `handling ${event.type}`,
              stripeSessionId: sessionIdOf(event),
              registrationId: "",
              email: "",
              error: result.error,
            });
            return retryable(result.error);
          }
          return ok({ received: true, id: event.id });
        } catch (e) {
          await store.releaseStripeEvent(event.id);
          const message = (e as Error)?.message ?? String(e);
          await alertFailedWrite({
            what: `handling ${event.type} (unexpected error)`,
            stripeSessionId: sessionIdOf(event),
            registrationId: "",
            email: "",
            error: message,
          });
          return retryable(message);
        }
      },
    },
  },
});

function sessionIdOf(event: Stripe.Event): string {
  const o = event.data.object as { id?: string };
  return o?.id ?? "";
}

type Handled = { ok: true } | { ok: false; error: string };

async function handle(event: Stripe.Event, store: ReturnType<typeof getStore>): Promise<Handled> {
  if (event.type === "checkout.session.expired") {
    const s = event.data.object as Stripe.Checkout.Session;
    /* Releases ONLY a reserved allocation. The store refuses to release a paid
       one, which is the out-of-order protection. */
    const released = await store.releaseReservation({
      stripeSessionId: s.id,
      reason: "checkout_expired",
    });
    return released.ok ? { ok: true } : { ok: false, error: released.error };
  }

  if (event.type === "charge.refunded") {
    /* Recorded, but capacity is NOT returned automatically. A refunded place
       is an operational decision — the attendee may still be coming — and
       silently reselling it is worse than leaving it held for a human. */
    const c = event.data.object as Stripe.Charge;
    console.info(`[refund] charge=${c.id} payment_intent=${String(c.payment_intent ?? "")}`);
    return { ok: true };
  }

  /* checkout.session.completed */
  const raw = event.data.object as Stripe.Checkout.Session;

  /* Re-read from Stripe rather than trusting the payload's money fields. */
  let s: Stripe.Checkout.Session;
  try {
    s = await stripe().checkout.sessions.retrieve(raw.id);
  } catch (e) {
    return { ok: false, error: `could not re-read session ${raw.id}: ${(e as Error)?.message}` };
  }

  const verified = await verifiedPayment(s);
  if (!verified.ok) {
    /* Not a valid paid session. Acknowledged as handled — retrying will not
       change it — but loudly, because it should not happen. */
    console.error(`[webhook] refusing to record session ${s.id}: ${verified.error}`);
    await alertFailedWrite({
      what: "a completed session that does not verify as paid",
      stripeSessionId: s.id,
      registrationId: s.client_reference_id ?? "",
      email: s.customer_details?.email ?? "",
      error: verified.error,
    });
    return { ok: true };
  }

  const registrationId = s.client_reference_id ?? s.metadata?.["registrationId"] ?? "";
  const organizationKey = s.metadata?.["organizationKey"] ?? "";
  const email = s.customer_details?.email ?? s.customer_email ?? "";

  /* THE ESSENTIAL WRITE. Until this succeeds, nothing is acknowledged. */
  const paid = await store.markPaid({
    registrationId,
    stripeSessionId: s.id,
    stripePaymentIntentId: typeof s.payment_intent === "string" ? s.payment_intent : "",
    amount: verified.amount,
    currency: verified.currency,
    paidAt: new Date().toISOString(),
  });
  if (!paid.ok) return { ok: false, error: `markPaid failed: ${paid.error}` };

  /* ONE ENTITLEMENT PER ORGANIZATION, for all time and across every pass that
     organization buys. Also essential: getting it wrong gives away assessments. */
  if (organizationKey) {
    const ent = await store.claimEntitlement({ organizationKey, registrationId });
    if (!ent.ok) return { ok: false, error: `entitlement claim failed: ${ent.error}` };
  }

  /* The confirmation email is NOT essential to acknowledgement: the payment
     and the place are recorded, and a failed send must not make Stripe retry a
     write that already succeeded. It is claimed, attempted, and the claim is
     released on failure so a later manual re-run can send it. */
  await sendConfirmationOnce(store, { registrationId, email, ...verified });

  return { ok: true };
}

async function sendConfirmationOnce(
  store: ReturnType<typeof getStore>,
  input: { registrationId: string; email: string; amount: string; currency: string },
): Promise<void> {
  if (!input.email || !input.registrationId) return;

  const claim = await store.claimEmailSend(input.registrationId);
  if (!claim.ok) {
    console.error(`[email] could not claim send for ${input.registrationId}: ${claim.error}`);
    return;
  }
  if (claim.alreadyDone) return;

  const sent = await sendConfirmation({
    to: input.email,
    firstName: "",
    amount: input.amount,
    currency: input.currency,
  });

  if (!sent.ok) {
    /* Nobody was emailed, so the row must not stay marked as though somebody
       was. Hand the claim back and alert — the payment and the seat are safe. */
    const released = await store.releaseEmailClaim(input.registrationId);
    await alertFailedWrite({
      what: released.ok
        ? "sending the confirmation email (claim released; it can be re-sent)"
        : "sending the confirmation email AND releasing its claim — the row is stuck " +
          "marked as emailed. Clear its 'email sent' cell to re-arm it",
      stripeSessionId: "",
      registrationId: input.registrationId,
      email: input.email,
      error: sent.error,
    });
  }
}
