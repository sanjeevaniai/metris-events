import { createFileRoute } from "@tanstack/react-router";

import { eventConfig } from "../../config/event";
import { registrationOpen } from "../../server/capacity";
import {
  attendeeDisposition,
  BUSINESS_EMAIL_NOTICE,
  classifyEmail,
} from "../../server/organization";
import { isPassId, pass } from "../../server/passes";
import {
  eventId,
  getStore,
  type Attendee,
  type Registration,
  type VerificationState,
} from "../../server/persistence";
import { json, trim } from "../../server/stripe";

/* Writes the purchase and its named attendees, BEFORE payment.

   Order matters and must not be reversed: the registration exists before a
   Checkout Session is created, so an abandoned checkout still leaves the lead
   behind and the webhook has a row to find.

   NO SALES QUALIFICATION. Nothing here refuses anyone on the strength of a job
   title, a role, an organization type or an answer. The only things that stop
   a registration are: registration being closed, a malformed body, a missing
   required field, a duplicate attendee, and an email address that cannot
   establish organizational identity — which is an access control, and routes
   to human review rather than to rejection. */

const ORG_TYPE_LABELS: Record<string, string> = {
  health_plan: "Health plan",
  provider: "Provider",
  health_tech: "Health technology or services",
  healthcare_services: "Healthcare services organization",
  other: "Other",
};

export function orgTypeLabel(value: string): string {
  return ORG_TYPE_LABELS[value] ?? value;
}

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

type RawAttendee = { name?: unknown; email?: unknown };

export const Route = createFileRoute("/api/register")({
  server: {
    handlers: {
      ANY: () =>
        new Response("Method not allowed. Use POST.", {
          status: 405,
          headers: { allow: "POST" },
        }),
      POST: async ({ request }) => {
        if (!registrationOpen()) {
          return json({ ok: false, error: "Registration for this session is closed." }, 409);
        }

        let d: Record<string, unknown>;
        try {
          d = (await request.json()) as Record<string, unknown>;
        } catch {
          return json({ ok: false, error: "Request body was not valid JSON." }, 400);
        }

        /* The pass decides the price and the capacity consumed, so an
           unrecognized one is refused rather than defaulted. */
        const passId = trim(d["passId"]);
        if (!isPassId(passId)) {
          return json({ ok: false, error: "Choose a pass before registering." }, 400);
        }
        const chosen = pass(passId);

        const firstName = trim(d["firstName"]);
        const lastName = trim(d["lastName"]);
        const email = trim(d["businessEmail"]).toLowerCase();
        const jobTitle = trim(d["jobTitle"]);
        const organization = trim(d["organization"]);
        const orgType = trim(d["organizationType"]);
        const country = trim(d["country"]);

        const missing = [
          !firstName && "First name",
          !lastName && "Last name",
          !email && "Business email",
          !jobTitle && "Job title",
          !organization && "Organization",
          !orgType && "Organization type",
          !country && "Country",
        ].filter(Boolean);
        if (missing.length) {
          return json({ ok: false, error: `${missing.join(", ")} required.` }, 400);
        }

        if (d["termsAccepted"] !== true) {
          return json({ ok: false, error: "The Terms and Privacy Policy must be accepted." }, 400);
        }

        /* Organizational identity. A consumer or disposable mailbox cannot
           establish it, so that registration is CAPTURED and held for review
           rather than turned away — an unusual domain is often a real
           customer. Only a malformed address is refused outright. */
        const identity = classifyEmail(email);
        if (identity.disposition === "refuse") {
          return json({ ok: false, error: identity.reason }, 400);
        }

        const verificationState: VerificationState =
          identity.disposition === "proceed" ? "verified" : "manual_review";

        /* Attendees. Executive is always exactly the purchaser. Team takes one
           to five named people; five PLACES are consumed either way. */
        const rawAttendees = Array.isArray(d["attendees"]) ? (d["attendees"] as RawAttendee[]) : [];
        const supplied = rawAttendees
          .map((a) => ({ name: trim(a?.name), email: trim(a?.email).toLowerCase() }))
          .filter((a) => a.name || a.email);

        if (passId === "team" && supplied.length > chosen.places) {
          return json(
            {
              ok: false,
              error: `The ${chosen.name} covers up to ${chosen.places} named attendees. ${eventConfig.moreThanFiveLine}`,
            },
            400,
          );
        }

        const people =
          passId === "executive"
            ? [{ name: `${firstName} ${lastName}`.trim(), email }]
            : supplied.length
              ? supplied
              : [{ name: `${firstName} ${lastName}`.trim(), email }];

        /* Every named attendee needs a name and an address of their own: a
           place without an address cannot be given individual joining
           credentials, which is the whole point of naming them. */
        for (const p of people) {
          if (!p.name || !p.email) {
            return json(
              { ok: false, error: "Every attendee needs both a name and a business email." },
              400,
            );
          }
        }

        const seen = new Set<string>();
        for (const p of people) {
          if (seen.has(p.email)) {
            return json({ ok: false, error: `${p.email} is listed more than once.` }, 400);
          }
          seen.add(p.email);
        }

        const registrationId = trim(d["registrationId"]) || newId("reg");
        const now = new Date().toISOString();

        const row: Registration = {
          eventId: eventId(),
          registrationId,
          organizationKey: identity.organizationKey,
          organizationName: organization,
          organizationType: orgTypeLabel(orgType),
          verifiedDomain: identity.kind === "corporate" ? identity.domain : "",
          primaryPurchaserName: `${firstName} ${lastName}`.trim(),
          primaryBusinessEmail: email,
          primaryJobTitle: jobTitle,
          country,
          passId,
          purchasedPlaces: chosen.places,
          registrationState: "registration_started",
          allocationState: "none",
          reservationExpiresAt: "",
          verificationState,
          verificationReason: identity.reason,
          stripeCheckoutSessionId: "",
          stripePaymentIntentId: "",
          amount: "",
          currency: "",
          termsAcceptedAt: now,
          /* null, not "", when consent was not given — a blank string in a
             consent column reads as though consent was recorded */
          marketingConsentAt: d["marketingConsent"] === true ? now : null,
          preliminaryUseCase: trim(d["preliminaryUseCase"], 600),
          createdAt: now,
          updatedAt: now,
        };

        const attendees: Attendee[] = people.map((p, i) => {
          const disp = attendeeDisposition(p.email, identity.organizationKey);
          return {
            eventId: eventId(),
            registrationId,
            organizationKey: identity.organizationKey,
            attendeeId: `${registrationId}_a${i + 1}`,
            attendeeName: p.name,
            attendeeEmail: p.email,
            verificationState: disp.disposition === "proceed" ? "verified" : "manual_review",
            verificationReason: disp.reason,
            /* Blocked, not pending: individual Zoom registration is not
               implemented, and "pending" would imply something is coming. */
            zoomRegistrationState: "blocked",
            zoomRegistrantId: "",
            joinLinkDeliveryState: "blocked",
            createdAt: now,
            updatedAt: now,
          };
        });

        /* A registration that is not durably recorded must not reach payment. */
        const written = await getStore().saveRegistration(row);
        if (!written.ok) return json({ ok: false, error: written.error }, 502);

        const attendeesWritten = await getStore().saveAttendees(attendees);
        if (!attendeesWritten.ok) return json({ ok: false, error: attendeesWritten.error }, 502);

        return json({
          ok: true,
          registrationId,
          passId,
          places: chosen.places,
          verificationState,
          /* Told plainly, so the page can explain rather than just refuse. */
          ...(verificationState === "manual_review"
            ? { reviewNotice: BUSINESS_EMAIL_NOTICE, reason: identity.reason }
            : {}),
          attendeesNeedingReview: attendees
            .filter((a) => a.verificationState === "manual_review")
            .map((a) => a.attendeeEmail),
        });
      },
    },
  },
});
