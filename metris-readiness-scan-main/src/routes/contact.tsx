import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/metris/LegalPage";
import { eventConfig } from "@/config/event";

const TITLE = "Contact METRIS";
const DESCRIPTION =
  "Contact METRIS about the Healthcare AI Readiness Executive Session, registration, or use-case assessment eligibility.";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/contact" },
    ],
    links: [{ rel: "canonical", href: "/contact" }],
  }),
  component: () => (
    <LegalPage
      title="Contact"
      intro={`Email ${eventConfig.supportEmail} with questions about registration, multiple attendees from one organization, or post-session assessment eligibility and scope.`}
    >
      <p>
        Please do not send patient data, member data, protected health information, or confidential
        organizational details by email.
      </p>
    </LegalPage>
  ),
});
