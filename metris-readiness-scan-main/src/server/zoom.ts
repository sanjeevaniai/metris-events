import "@tanstack/react-start/server-only";

/* Attendee access to the webinar.

   ============================ NOT IMPLEMENTED ============================
   This event requires ONE ZOOM REGISTRATION PER NAMED ATTENDEE, each with its
   own join URL bound to that attendee's own email address. That is not what
   this module can do, and it is not what the previous implementation did.

   What existed before: a single ZOOM_JOIN_URL environment variable, returned
   to anyone whose payment had been verified. One URL, with the passcode inside
   it, identical for every attendee. That is exactly the forwardable shared
   link this event forbids: one Team Pass buyer could hand it to fifty people
   and nothing would notice.

   That function has been REMOVED rather than left available, because leaving
   it in place is how it ends up called. Nothing in this application can hand
   out joining credentials until the work below is done.

   WHAT IS NEEDED TO IMPLEMENT IT
     1. A Zoom Webinar (not a Meeting) with registration REQUIRED, and its
        numeric webinar id.
     2. A Server-to-Server OAuth app in the Zoom account, with scope
        `webinar:write:admin`, giving an account id, client id and secret.
     3. Those four values in the environment as ZOOM_ACCOUNT_ID,
        ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET and ZOOM_WEBINAR_ID.
     4. registerAttendee() below implemented against
        POST /v2/webinars/{webinarId}/registrants, which returns a registrant
        id and a join_url unique to that attendee.
     5. Zoom's own registration-confirmation email left ENABLED, so Zoom
        delivers each unique link directly to the attendee it belongs to and
        this application never has to carry one.

   None of those four values exists yet. Until they do, every call here fails
   loudly and the attendee's join-link delivery state stays "blocked", which is
   an honest, visible, recoverable state — not a silent one.
   ========================================================================= */

export type ZoomRegistrant = {
  registrantId: string;
  /** unique to this attendee; never shown in a browser, never logged */
  joinUrl: string;
};

export type ZoomResult =
  { ok: true; registrant: ZoomRegistrant } | { ok: false; error: string; blocked: boolean };

/** Whether individual attendee registration is possible at all. */
export function zoomConfigured(): boolean {
  return ["ZOOM_ACCOUNT_ID", "ZOOM_CLIENT_ID", "ZOOM_CLIENT_SECRET", "ZOOM_WEBINAR_ID"].every(
    (k) => String(process.env[k] ?? "").trim() !== "",
  );
}

export const ZOOM_NOT_CONFIGURED =
  "Individual Zoom registration is not configured. This event requires one Zoom " +
  "registrant per named attendee; a single shared join link is not acceptable. " +
  "Set ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET and ZOOM_WEBINAR_ID, " +
  "and implement registerAttendee() against the Zoom registrants API.";

/* Creates one Zoom registrant for one attendee.

   Deliberately unimplemented. It refuses rather than returning a shared link,
   because a shared link would satisfy the type signature while violating the
   requirement — the most dangerous kind of wrong. */
export async function registerAttendee(_attendee: {
  email: string;
  firstName: string;
  lastName: string;
  organization: string;
}): Promise<ZoomResult> {
  if (!zoomConfigured()) {
    return { ok: false, error: ZOOM_NOT_CONFIGURED, blocked: true };
  }
  return {
    ok: false,
    blocked: true,
    error:
      "Zoom credentials are present but registerAttendee() is not implemented. " +
      "Implement POST /v2/webinars/{webinarId}/registrants before taking payment " +
      "for an event that promises individual joining credentials.",
  };
}

/* What the success page is allowed to say. It contains no link, because there
   is no per-attendee link to give it and a shared one is forbidden. */
export const JOINING_INSTRUCTIONS_COPY =
  "Your payment is confirmed. Joining instructions will be sent to each verified " +
  "attendee by email.";
