import { createFileRoute } from "@tanstack/react-router";

import { availability, registrationOpen } from "../../server/capacity";
import { getStore } from "../../server/persistence";
import { json } from "../../server/stripe";

/* What the page is allowed to know about capacity.

   This is verified server state — counted from the store, not from anything a
   browser said. The page uses it to decide which CTAs to show, and that is a
   DISPLAY decision only: it cannot authorize a checkout. The binding check is
   the atomic reservation in /api/checkout, which runs again regardless of what
   this endpoint said a moment ago.

   No exact remaining count is published. "How many places are left" is
   commercially sensitive and invites gaming, and the page does not need it to
   decide what to render — it needs to know which passes still fit. */

export const Route = createFileRoute("/api/availability")({
  server: {
    handlers: {
      ANY: () =>
        new Response("Method not allowed. Use GET.", {
          status: 405,
          headers: { allow: "GET" },
        }),
      GET: async () => {
        if (!registrationOpen()) {
          return json({
            ok: true,
            open: false,
            executiveAvailable: false,
            teamAvailable: false,
            soldOut: false,
          });
        }

        const used = await getStore().usedCapacity();
        if (!used.ok) {
          /* Availability is unknown, which is not the same as sold out. The
             page shows a neutral unavailable state rather than inventing
             either answer. */
          return json({ ok: false, open: true, error: used.error }, 503);
        }

        const a = availability(used);
        return json({
          ok: true,
          open: true,
          executiveAvailable: a.executiveAvailable,
          teamAvailable: a.teamAvailable,
          soldOut: a.soldOut,
          /* Deliberately NOT the exact remaining count. Enough for the page to
             explain why the Team Pass disappeared, and nothing more. */
          teamPassUnavailableReason: a.teamAvailable
            ? null
            : a.soldOut
              ? "sold_out"
              : "fewer_than_five_remaining",
        });
      },
    },
  },
});
