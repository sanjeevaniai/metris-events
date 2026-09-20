import { useState } from "react";
import { Plus } from "lucide-react";
import { eventConfig } from "@/config/event";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";

const FAQS = [
  {
    id: "individual-or-team",
    q: "Can I attend individually or bring my team?",
    a: "Choose the Executive Pass for one named attendee or the Organization Team Pass for up to five named attendees from the same company. Every attendee is registered individually and receives unique joining credentials. Organizations wishing to bring more than five people should contact METRIS.",
  },
  {
    id: "share-link",
    q: "Can we share one Zoom link?",
    a: "No. For security and attendance integrity, every attendee must register with their own business email and use their own joining credentials.",
  },
  {
    id: "cost",
    q: "What does registration cost?",
    a: "The Executive Pass is $249 for one named attendee. The Organization Team Pass is $1,125 for up to five named attendees from the same verified organization.",
  },
  {
    id: "assessments-per-team",
    q: "How many assessments does a team receive?",
    a: "Each verified organization receives one eligible use-case readiness assessment, regardless of the number of attendees or passes purchased.",
  },
  {
    id: "different-domains",
    q: "Can colleagues use different company domains?",
    a: "Team members should normally use email addresses belonging to the verified organization. Legitimate subsidiaries, acquired companies, and other domain differences may be reviewed manually.",
  },
  {
    id: "personal-email",
    q: "Can I register with a personal email address?",
    a: "Business email is required for automatic registration. If your organization does not use a corporate email domain, contact METRIS for verification.",
  },
  {
    id: "transfer",
    q: "Can I transfer my registration?",
    a: "Contact METRIS if a named attendee must be replaced. Joining credentials are individual and must not be transferred or posted publicly.",
  },
  {
    id: "certification",
    q: "Is METRIS a certification?",
    a: "No. METRIS provides organizational readiness measurement and evidence. It does not provide certification, legal advice, or a regulatory compliance opinion.",
  },
  {
    id: "individual-employees",
    q: "Does the assessment evaluate individual employees?",
    a: "No. Where workforce evidence is within the agreed assessment scope, it is produced at role-group level. It is not an individual employment assessment and must not be used for hiring, firing, promotion, or other employment decisions.",
  },
];

export function FaqAccordion() {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="border-t border-hairline">
      {FAQS.map((item) => {
        const isOpen = openId === item.id;
        return (
          <div key={item.id} className="border-b border-hairline">
            <h3>
              <button
                type="button"
                id={`faq-trigger-${item.id}`}
                aria-expanded={isOpen}
                aria-controls={`faq-panel-${item.id}`}
                onClick={() => {
                  const next = isOpen ? null : item.id;
                  setOpenId(next);
                  if (next) track("faq_opened", { faq_id: item.id });
                }}
                className="flex w-full items-start justify-between gap-6 py-6 text-left"
              >
                <span className="max-w-3xl text-[1.25rem] leading-snug font-medium text-foreground md:text-[1.5rem]">
                  {item.q}
                </span>
                <Plus
                  aria-hidden
                  className={cn(
                    "mt-1 size-5 shrink-0 text-muted-foreground transition-transform duration-300",
                    isOpen && "rotate-45",
                  )}
                />
              </button>
            </h3>
            <div
              id={`faq-panel-${item.id}`}
              role="region"
              aria-labelledby={`faq-trigger-${item.id}`}
              hidden={!isOpen}
              className="pb-7"
            >
              <p className="max-w-3xl text-[1.0625rem] leading-relaxed text-muted-foreground md:text-[1.125rem]">
                {item.a}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
