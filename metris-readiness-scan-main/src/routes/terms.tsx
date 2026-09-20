import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/metris/LegalPage";

const TITLE = "Terms and Conditions (draft) — METRIS";
const DESCRIPTION =
  "Draft terms and conditions for the METRIS Healthcare AI Readiness Executive Session, pending founder approval.";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/terms" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "/terms" }],
  }),
  component: () => (
    <LegalPage
      title="Terms and Conditions"
      intro="Approved terms have not been supplied. This route exists so registration links resolve correctly; it must be replaced with founder-approved language before launch."
    >
      <p>
        Required before publication: registration and attendance terms, the exact scope and
        entitlement of the post-session readiness assessment, eligibility review process,
        intellectual property terms, limitation of liability, and governing law.
      </p>
      <p>
        METRIS provides organizational readiness measurement and evidence. It is not a
        certification, regulatory or legal opinion, technical validation of an AI model, or
        individual employment assessment.
      </p>
    </LegalPage>
  ),
});
