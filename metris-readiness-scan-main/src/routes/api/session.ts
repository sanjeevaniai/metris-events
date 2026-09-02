import { createFileRoute } from "@tanstack/react-router";

import { hasStripeKey, json, stripe } from "../../server/stripe";

/* Looks a Checkout session up with Stripe so the confirmation page can prove a
   payment happened before it confirms anything.

   The session id arrives in the URL, which anyone can edit, so the page is not
   allowed to believe it. It asks here, this asks Stripe, and only a
   payment_status of "paid" comes back as paid: true. A canceled, unpaid or
   invented session id gets paid: false and the page shows nothing confirming —
   and, critically, no joining link. */

export const Route = createFileRoute("/api/session")({
  server: {
    handlers: {
      /* Without this, a wrong-method request falls through to the router
         and renders the page with a 200 instead of refusing. */
      ANY: () =>
        new Response("Method not allowed. Use GET.", {
          status: 405,
          headers: { allow: "GET" },
        }),
      GET: async ({ request }) => {
        if (!hasStripeKey()) {
          return json({ ok: false, error: "STRIPE_SECRET_KEY is not set on the server." }, 500);
        }

        const id = (new URL(request.url).searchParams.get("session_id") ?? "").trim();
        if (!id || !/^cs_[A-Za-z0-9_]+$/.test(id)) {
          return json({ ok: false, paid: false, error: "No usable session id." }, 400);
        }

        try {
          const s = await stripe().checkout.sessions.retrieve(id);
          const paid = s.payment_status === "paid";

          /* THE MINIMUM the confirmation page needs, and nothing else. No
             joining link (there is none to give — attendees are registered
             with Zoom individually and Zoom mails each their own), no
             metadata dump, no organization key, no attendee list. */
          return json({
            ok: true,
            paid,
            paymentStatus: s.payment_status ?? "",
            email: paid ? (s.customer_details?.email ?? s.customer_email ?? "") : "",
            amount: paid ? ((s.amount_total ?? 0) / 100).toFixed(2) : "",
            currency: paid ? (s.currency ?? "usd").toUpperCase() : "",
            passId: paid ? (s.metadata?.["passId"] ?? "") : "",
            places: paid ? Number(s.metadata?.["places"] ?? 0) : 0,
          });
        } catch (e) {
          /* an id Stripe does not know is a client mistake, not a server fault */
          const err = e as { statusCode?: number; code?: string; message?: string };
          const missing = err?.statusCode === 404 || err?.code === "resource_missing";
          return json(
            {
              ok: false,
              paid: false,
              error: missing
                ? "Stripe does not recognize that session."
                : `Could not reach Stripe: ${err?.message ?? String(e)}`,
            },
            missing ? 404 : 502,
          );
        }
      },
    },
  },
});
