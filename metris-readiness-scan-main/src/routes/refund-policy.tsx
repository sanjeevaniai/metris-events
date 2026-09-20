import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/metris/LegalPage";

const TITLE = "Refund and Cancellation Policy (draft) — METRIS";
const DESCRIPTION =
  "Draft refund and cancellation policy for the METRIS Healthcare AI Readiness Executive Session, pending founder approval.";

export const Route = createFileRoute("/refund-policy")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/refund-policy" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "/refund-policy" }],
  }),
  component: () => (
    <LegalPage
      title="Refund and Cancellation Policy"
      intro="An approved refund and cancellation policy has not been supplied. Registration must not be opened to the public until this text is confirmed, because the policy has to be visible before payment."
    >
      <p>
        Required before publication: refund window, transfer or substitution rules, what happens if
        the session is rescheduled or cancelled by METRIS, and whether the included post-session
        assessment is refundable separately.
      </p>
    </LegalPage>
  ),
});
