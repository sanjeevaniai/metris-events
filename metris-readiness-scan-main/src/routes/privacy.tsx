import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/metris/LegalPage";

const TITLE = "Privacy Policy (draft) — METRIS";
const DESCRIPTION =
  "Draft privacy policy for the METRIS Healthcare AI Readiness Executive Session, pending founder approval.";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/privacy" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "/privacy" }],
  }),
  component: () => (
    <LegalPage
      title="Privacy Policy"
      intro="Approved privacy policy text has not been supplied. This route exists so registration links resolve correctly; it must be replaced with founder-approved language before launch."
    >
      <p>
        Required before publication: what registration data is collected, the lawful basis for
        processing, where it is stored, retention period, processors used (payment provider, email
        provider, analytics), international transfer terms, and how to request deletion.
      </p>
      <p>
        METRIS does not ask for and must not receive patient data, member data, protected health
        information, or confidential organizational details through this website.
      </p>
    </LegalPage>
  ),
});
