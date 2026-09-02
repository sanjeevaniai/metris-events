import "@tanstack/react-start/server-only";

import { eventConfig, eventWhenLine } from "../config/event";

/* Transactional mail, through Resend.

   Called over Resend's REST API rather than through the SDK so this adds no
   dependency and nothing new to keep patched.

   SENDING DOMAIN: this must go out from a subdomain of sanjeevaniai.com. The
   cold-outreach domains are kept deliberately separate and sending
   transactional mail from one would put the attendee's joining link behind
   whatever reputation that domain has. See SETUP.md for the DNS records. */

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export type SendResult = { ok: true; id: string } | { ok: false; error: string };

/* Where a reply goes. The From address is a sending subdomain nobody reads,
   so without this a reply to a confirmation lands nowhere. */
const REPLY_TO = "suneeta@sanjeevaniai.com";

export async function sendRaw(opts: {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
}): Promise<SendResult> {
  const key = String(process.env["RESEND_API_KEY"] ?? "").trim();
  const from = String(process.env["EMAIL_FROM"] ?? "").trim();

  if (!key) return { ok: false, error: "RESEND_API_KEY is not set." };
  if (!from) return { ok: false, error: "EMAIL_FROM is not set." };

  let res: Response;
  try {
    res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [opts.to],
        subject: opts.subject,
        text: opts.text,
        ...(opts.replyTo ? { reply_to: opts.replyTo } : {}),
      }),
    });
  } catch (e) {
    return { ok: false, error: `Could not reach Resend: ${(e as Error)?.message ?? String(e)}` };
  }

  const body = (await res.json().catch(() => null)) as { id?: string; message?: string } | null;

  if (!res.ok) {
    return {
      ok: false,
      error: `Resend answered ${res.status}: ${body?.message ?? "no reason given"}`,
    };
  }
  return { ok: true, id: body?.id ?? "" };
}

/* ------------------------- the confirmation email ------------------------- */

export type ConfirmationInput = {
  to: string;
  firstName: string;
  jobTitle?: string;
  amount: string;
  currency: string;
};

export function confirmationText(input: ConfirmationInput): string {
  /* The same string the page shows. eventWhenLine refuses to print a bracketed
     placeholder at an attendee: until the date is real it says so in words,
     in exactly the wording the page used. */
  const when = eventWhenLine;

  return [
    `${input.firstName ? input.firstName + "," : "Hello,"}`,
    "",
    `You are registered for ${eventConfig.shortName}.`,
    "",
    `When:     ${when}`,
    `Duration: ${eventConfig.durationMinutes} minutes`,
    `Paid:     ${input.amount} ${input.currency}`,
    "",
    /* No joining link in this email, deliberately. Each named attendee gets
       their own Zoom registration and Zoom sends them their own link; a link
       in this email would be one link, forwardable to anyone. */
    "Joining instructions will be sent to each verified attendee by email,",
    "at their own address. They are individual and must not be shared.",
    "",
    /* ------------------------------------------------------------------
       PLACEHOLDER — HOW THE READINESS ASSESSMENT IS CLAIMED IS NOT DECIDED
       YET. Do not invent a link, a form, a booking flow or a deadline here.
       Replace these two lines once the claim route exists.
       ------------------------------------------------------------------ */
    "Your registration also includes one eligible use-case readiness assessment",
    "after the session. [TODO: how to claim it — not yet decided. Nothing is",
    "sent about this yet.]",
    "",
    "See you there.",
  ].join("\n");
}

export async function sendConfirmation(input: ConfirmationInput): Promise<SendResult> {
  return sendRaw({
    to: input.to,
    subject: `You're registered — ${eventConfig.shortName}`,
    text: confirmationText(input),
    replyTo: REPLY_TO,
  });
}
