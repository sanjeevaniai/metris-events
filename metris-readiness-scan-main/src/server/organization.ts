import "@tanstack/react-start/server-only";

/* Who the buyer's organization is, derived from their email domain.

   This is an ACCESS AND SECURITY control, not sales qualification. Nothing
   here scores a lead or judges whether an organization is worth selling to.
   It answers one question: has this person demonstrated that they belong to
   the organization they claim, well enough to be sold a place automatically?

   A consumer mailbox cannot answer that question, so it does not proceed to
   payment automatically. It is NOT rejected — it is routed to review, because
   a real healthcare organization on an unusual domain is a customer, not an
   attacker. */

/* Consumer mailbox providers. Not exhaustive and never will be: this is a
   floor, not a wall. Anything not listed still has to survive review if it
   looks wrong, and anything listed can still be admitted by a human. */
const CONSUMER_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.co.uk",
  "ymail.com",
  "hotmail.com",
  "hotmail.co.uk",
  "outlook.com",
  "live.com",
  "msn.com",
  "aol.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "proton.me",
  "protonmail.com",
  "gmx.com",
  "gmx.net",
  "mail.com",
  "zoho.com",
  "yandex.com",
  "yandex.ru",
  "fastmail.com",
  "hey.com",
  "tutanota.com",
  "pm.me",
]);

/* Throwaway-address providers. Same treatment as consumer domains — routed to
   review rather than refused — but tracked separately so the review queue can
   tell "someone's personal Gmail" apart from "someone hiding". */
const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "10minutemail.com",
  "tempmail.com",
  "throwawaymail.com",
  "yopmail.com",
  "sharklasers.com",
  "trashmail.com",
  "getnada.com",
  "dispostable.com",
]);

export type DomainKind = "corporate" | "consumer" | "disposable" | "invalid";

/* What happens next for this address.

   proceed  — may be sold a place automatically
   review   — captured, held for a human, never silently rejected
   refuse   — the address is not an address at all */
export type Disposition = "proceed" | "review" | "refuse";

export type EmailIdentity = {
  email: string;
  domain: string;
  kind: DomainKind;
  disposition: Disposition;
  /** stable internal identifier for the organization, "" when not derivable */
  organizationKey: string;
  /** why, in words a human reviewing the queue can act on */
  reason: string;
};

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/* The message the page shows for anything that cannot proceed automatically.
   One sentence, no blame, and a route forward — a legitimate buyer on an
   unusual domain must never read this as a rejection. */
export const BUSINESS_EMAIL_NOTICE =
  "Please register with your organization's business email. If your " +
  "organization does not use a corporate email domain, contact us for verification.";

export function emailDomain(email: string): string {
  const at = email.lastIndexOf("@");
  if (at < 0) return "";
  return email
    .slice(at + 1)
    .trim()
    .toLowerCase();
}

/* The normalized organization identifier.

   Derived from the verified corporate domain, with the public suffix left
   alone: "uk.co" style compound suffixes make "strip everything but the last
   two labels" wrong, so the whole domain is kept and only cased and trimmed.
   Two addresses at the same domain therefore land on the same key, which is
   what makes one-assessment-per-organization enforceable.

   A documented manual override exists for subsidiaries, acquisitions, multiple
   valid domains, government and academic health systems, and third-party
   administrators: ORGANIZATION_KEY_OVERRIDES maps any number of domains onto
   one key. It is environment configuration rather than code so a merger does
   not need a deploy. */
export function organizationKeyFor(domain: string): string {
  const d = domain.trim().toLowerCase();
  if (!d) return "";
  return overrides()[d] ?? d;
}

/* JSON in the environment: {"acquired-co.com":"parent-co.com"}. Malformed
   configuration is ignored loudly rather than throwing — a bad override must
   not take registration down. */
function overrides(): Record<string, string> {
  const raw = String(process.env["ORGANIZATION_KEY_OVERRIDES"] ?? "").trim();
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof k === "string" && typeof v === "string") {
        out[k.trim().toLowerCase()] = v.trim().toLowerCase();
      }
    }
    return out;
  } catch {
    console.error(
      "[organization] ORGANIZATION_KEY_OVERRIDES is not valid JSON; ignoring it. " +
        "Subsidiary and multi-domain mappings are NOT in force.",
    );
    return {};
  }
}

export function classifyEmail(rawEmail: string): EmailIdentity {
  const email = String(rawEmail ?? "")
    .trim()
    .toLowerCase();

  if (!email || !EMAIL_RE.test(email)) {
    return {
      email,
      domain: "",
      kind: "invalid",
      disposition: "refuse",
      organizationKey: "",
      reason: "That email address does not look complete.",
    };
  }

  const domain = emailDomain(email);

  if (DISPOSABLE_DOMAINS.has(domain)) {
    return {
      email,
      domain,
      kind: "disposable",
      disposition: "review",
      organizationKey: "",
      reason: `${domain} is a disposable mailbox provider, so it cannot establish organizational identity.`,
    };
  }

  if (CONSUMER_DOMAINS.has(domain)) {
    return {
      email,
      domain,
      kind: "consumer",
      disposition: "review",
      organizationKey: "",
      reason: `${domain} is a consumer mailbox provider, so it cannot establish organizational identity.`,
    };
  }

  return {
    email,
    domain,
    kind: "corporate",
    disposition: "proceed",
    organizationKey: organizationKeyFor(domain),
    reason: "",
  };
}

/* Whether a team attendee belongs to the buyer's organization.

   Same domain is the normal case and proceeds. A different domain is NOT
   refused — subsidiaries and acquisitions are real — it goes to review, and
   the record says which domain it was so a human can decide once. */
export function attendeeDisposition(
  attendeeEmail: string,
  buyerOrganizationKey: string,
): { disposition: Disposition; reason: string } {
  const id = classifyEmail(attendeeEmail);
  if (id.disposition === "refuse") return { disposition: "refuse", reason: id.reason };
  if (id.kind !== "corporate") return { disposition: "review", reason: id.reason };

  if (id.organizationKey === buyerOrganizationKey) {
    return { disposition: "proceed", reason: "" };
  }
  return {
    disposition: "review",
    reason:
      `${id.domain} is not the purchasing organization's domain. ` +
      `Legitimate subsidiaries and acquired companies are approved here by hand.`,
  };
}
