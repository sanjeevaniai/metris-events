import { createFileRoute } from "@tanstack/react-router";

import { availability, registrationOpen } from "../../server/capacity";
import { classifyEmail } from "../../server/organization";
import {
  expectedCurrency,
  expectedUnitAmount,
  isPassId,
  pass,
  priceIdFor,
} from "../../server/passes";
import { getStore } from "../../server/persistence";
import { EMAIL_RE, hasStripeKey, json, stripe, trim } from "../../server/stripe";

/* Creates a Stripe Checkout Session and holds capacity for it.

   THE ORDER IS THE DESIGN, and it is the order in the specification:

     1. validate the pass and the buyer
     2. refuse a mailbox that cannot establish organizational identity
     3. create the Stripe session, 30-minute expiry, URL NOT RETURNED YET
     4. atomically reserve the pass's places against that session id
     5. if capacity refused  -> expire the unused session, answer sold out
     6. if capacity granted  -> return the URL

   Creating the session first looks backwards and is not. The reservation is
   keyed on the checkout session id, which is the only identifier that both the
   sheet and the expiry webhook can see. Reserving before the session exists
   would leave a held place that no Stripe event can ever release.

   The cost of that ordering is a Stripe session that is sometimes created and
   immediately expired. That is cheap, invisible to the buyer, and leaves no
   charge. The alternative — a reserved place with nothing to release it — is
   a permanent hole in inventory. */

/* Stripe's minimum session lifetime is 30 minutes, which is also what the
   specification asks for. Shorter is not accepted by the API. */
const RESERVATION_MINUTES = 30;

const META_KEYS = [
  "registrationId",
  "passId",
  "name",
  "email",
  "jobTitle",
  "company",
  "country",
] as const;

export const Route = createFileRoute("/api/checkout")({
  server: {
    handlers: {
      ANY: () =>
        new Response("Method not allowed. Use POST.", {
          status: 405,
          headers: { allow: "POST" },
        }),
      POST: async ({ request }) => {
        if (!registrationOpen()) {
          return json({ ok: false, soldOut: false, error: "Registration is closed." }, 409);
        }
        if (!hasStripeKey()) {
          return json(
            { ok: false, error: "STRIPE_SECRET_KEY is not set, so payment cannot be taken." },
            500,
          );
        }

        let d: Record<string, unknown>;
        try {
          d = (await request.json()) as Record<string, unknown>;
        } catch {
          return json({ ok: false, error: "Request body was not valid JSON." }, 400);
        }

        const passId = trim(d["passId"]);
        if (!isPassId(passId)) {
          return json({ ok: false, error: "That is not a pass we recognize." }, 400);
        }
        const chosen = pass(passId);

        const registrationId = trim(d["registrationId"]);
        if (!registrationId) {
          return json({ ok: false, error: "This checkout has no registration to attach to." }, 400);
        }

        const email = trim(d["email"]).toLowerCase();
        if (!email || !EMAIL_RE.test(email)) {
          return json({ ok: false, error: "That email address does not look complete." }, 400);
        }

        /* Enforced again here, because the page check is a courtesy and this is
           the control: anyone can post to this endpoint directly. */
        const identity = classifyEmail(email);
        if (identity.disposition !== "proceed") {
          return json(
            {
              ok: false,
              needsReview: true,
              error:
                "This registration needs to be verified by hand before payment. " + identity.reason,
            },
            403,
          );
        }

        const price = priceIdFor(passId);
        if (!price.ok) return json({ ok: false, error: price.error }, 500);

        const store = getStore();

        /* An early, non-binding look at capacity, purely so an obviously
           sold-out event does not create a Stripe session at all. The BINDING
           check is the atomic reservation below — this one can be stale. */
        const used = await store.usedCapacity();
        if (!used.ok) {
          /* Capacity cannot be established, so a place cannot be sold. Taking
             payment here would be selling a place we cannot count. */
          return json(
            {
              ok: false,
              error:
                "We cannot confirm availability right now, so payment is not being taken. " +
                "Nothing has been charged. Please try again shortly.",
            },
            503,
          );
        }
        const avail = availability(used);
        if (avail.remaining < chosen.places) {
          return json(
            {
              ok: false,
              soldOut: true,
              error: avail.soldOut
                ? "This session is fully booked."
                : `Fewer than ${chosen.places} places remain, so the ${chosen.name} is no longer available.`,
              executiveAvailable: avail.executiveAvailable,
              teamAvailable: avail.teamAvailable,
            },
            409,
          );
        }

        const site =
          String(process.env["PUBLIC_SITE_URL"] ?? process.env["SITE_URL"] ?? "").trim() ||
          new URL(request.url).origin;

        const sk = stripe();

        /* Refuse a price that does not exist, is archived, or is not the amount
           and currency this pass advertises — before anyone sees a card form. */
        try {
          const p = await sk.prices.retrieve(price.priceId);
          if (!p.active) {
            return json(
              { ok: false, error: `The Stripe price in ${chosen.priceEnvVar} is archived.` },
              500,
            );
          }
          if (
            p.unit_amount !== expectedUnitAmount(passId) ||
            p.currency !== expectedCurrency(passId)
          ) {
            const actual = ((p.unit_amount ?? 0) / 100).toFixed(2);
            return json(
              {
                ok: false,
                error:
                  `The Stripe price in ${chosen.priceEnvVar} is ${actual} ` +
                  `${(p.currency ?? "").toUpperCase()}, but the page advertises ` +
                  `${chosen.priceLabel} ${chosen.currency}. Refusing to charge a different amount.`,
              },
              500,
            );
          }
        } catch (e) {
          return json(
            { ok: false, error: `Stripe could not confirm the price: ${(e as Error)?.message}` },
            502,
          );
        }

        const expiresAt = Math.floor(Date.now() / 1000) + RESERVATION_MINUTES * 60;

        let session: { id: string; url: string | null };
        try {
          const created = await sk.checkout.sessions.create({
            mode: "payment",
            line_items: [{ price: price.priceId, quantity: 1 }],
            customer_email: email,
            client_reference_id: registrationId,
            expires_at: expiresAt,
            metadata: {
              passId,
              places: String(chosen.places),
              organizationKey: identity.organizationKey,
              ...Object.fromEntries(
                META_KEYS.map((k) => [k, trim(d[k], 480)]).filter(([, v]) => v),
              ),
            },
            success_url: `${site}/?status=success&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${site}/?status=cancelled#register`,
          });
          session = { id: created.id, url: created.url };
        } catch (e) {
          return json(
            { ok: false, error: `Stripe could not start the payment: ${(e as Error)?.message}` },
            502,
          );
        }

        /* THE BINDING CHECK. Atomic at the store: two buyers racing for the
           last place are serialized, and exactly one is granted. */
        const reservation = await store.reserveSeats({
          registrationId,
          stripeSessionId: session.id,
          places: chosen.places,
          expiresAt: new Date(expiresAt * 1000).toISOString(),
        });

        if (!reservation.ok || !reservation.granted) {
          /* The session exists but must never be used. Expire it so it cannot
             be paid, and so Stripe's own expiry event does not later try to
             release a reservation that was never granted. */
          try {
            await sk.checkout.sessions.expire(session.id);
          } catch (e) {
            console.error(
              `[checkout] could not expire unused session ${session.id}: ${(e as Error)?.message}`,
            );
          }

          if (!reservation.ok) {
            return json(
              {
                ok: false,
                error:
                  "We could not hold your place, so payment is not being taken. " +
                  "Nothing has been charged. Please try again.",
              },
              503,
            );
          }
          return json(
            {
              ok: false,
              soldOut: true,
              error: "The last places went while you were filling this in. Nothing was charged.",
              remaining: reservation.remaining,
            },
            409,
          );
        }

        if (!session.url) {
          await store.releaseReservation({
            stripeSessionId: session.id,
            reason: "checkout_creation_failed",
          });
          return json({ ok: false, error: "Stripe did not return a payment link." }, 502);
        }

        return json({ ok: true, url: session.url, id: session.id, expiresAt });
      },
    },
  },
});
