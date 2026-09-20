import "@tanstack/react-start/server-only";

import { sendRaw } from "./email";

/* Where a failure goes so that somebody sees it.

   The webhook answers Stripe before it writes anything down, which is a
   deliberate trade: Stripe never retries and never marks the endpoint failing,
   but that also means Stripe is no longer the thing that guarantees the write
   happened. Nothing else will chase it. So every failed write has to be loud.

   Two channels, because they fail differently:
     console.error  — always. Shows up in the host's function logs.
     email          — if ALERT_EMAIL is set. Survives nobody reading the logs.

   Every alert carries the Stripe session id, because that is the one handle
   that can rebuild the registration from Stripe on its own. */
export async function alertFailedWrite(opts: {
  what: string;
  stripeSessionId: string;
  registrationId: string;
  email: string;
  error: string;
}): Promise<void> {
  const line =
    `[registration-not-recorded] ${opts.what} failed. ` +
    `stripe_session_id=${opts.stripeSessionId} registration_id=${opts.registrationId || "(none)"} ` +
    `email=${opts.email || "(none)"} error=${opts.error}`;

  console.error(line);

  const to = String(process.env["ALERT_EMAIL"] ?? "").trim();
  if (!to) return;

  try {
    const sent = await sendRaw({
      to,
      subject: `Registration not recorded — ${opts.stripeSessionId}`,
      text: [
        "A payment succeeded but the registration was not recorded.",
        "",
        `What failed:      ${opts.what}`,
        `Stripe session:   ${opts.stripeSessionId}`,
        `Registration id:  ${opts.registrationId || "(none)"}`,
        `Attendee email:   ${opts.email || "(none)"}`,
        `Error:            ${opts.error}`,
        "",
        "The payment is real and is in Stripe. To recover, open that session in",
        "the Stripe dashboard — its metadata carries the name, email, job title,",
        "organization and every other contact field — and add the row by hand.",
      ].join("\n"),
    });
    /* sendRaw reports failure by returning, not by throwing, so this has to be
       checked — otherwise the alert channel can fail in silence, which is the
       one thing an alert channel must never do. */
    if (!sent.ok) console.error("[alert-delivery-failed]", sent.error);
    else console.error(`[alert-delivered] to=${to} id=${sent.id}`);
  } catch (e) {
    /* swallowed so it cannot mask the original failure the alert is about */
    console.error("[alert-delivery-failed]", (e as Error)?.message ?? String(e));
  }
}
