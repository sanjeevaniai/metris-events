import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import heroImage from "@/assets/hero-metris.jpg";
import panelImage from "@/assets/panel-measure.jpg";
import { eventConfig, eventMetaLine, isPlaceholder } from "@/config/event";
import { track } from "@/lib/analytics";
import { Reveal } from "@/components/metris/Reveal";
import { Scene } from "@/components/metris/Scene";
import { SiteNav } from "@/components/metris/SiteNav";
import { SiteFooter } from "@/components/metris/SiteFooter";
import { UseCaseRail } from "@/components/metris/UseCaseRail";
import { PricingSection } from "@/components/metris/PricingSection";
import { useAvailability } from "@/components/metris/useAvailability";
import { FaqAccordion } from "@/components/metris/FaqAccordion";
import { RegistrationForm } from "@/components/metris/RegistrationForm";
import { scrollToSection } from "@/components/metris/nav-data";

const searchSchema = z.object({
  status: z.enum(["success", "cancelled"]).optional(),
  /* Stripe puts the Checkout Session id here on the way back. It is in the
     address bar, so anyone can edit it — SuccessCard believes nothing until
     /api/session has asked Stripe about it. */
  session_id: z.string().optional(),
});

const TITLE = "METRIS Healthcare AI Readiness Executive Session";
const DESCRIPTION =
  "A 90-minute live working session for healthcare executives on measuring organizational readiness for one selected AI use case. Passes from $249. Each verified organization receives one eligible use-case readiness assessment, subject to eligibility review.";

export const Route = createFileRoute("/")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: eventConfig.canonicalUrl },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: eventConfig.canonicalUrl }],
    // NOTE: Event/Organization JSON-LD is intentionally omitted until every
    // event fact (date, time, URL, entity) is confirmed. Never ship placeholders
    // inside structured data.
  }),
  component: MetrisEventPage,
});

function RegisterButton({
  location,
  variant = "solid",
  className = "",
}: {
  location: string;
  variant?: "solid" | "light";
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        track("cta_register_click", { location });
        scrollToSection("register");
      }}
      className={
        "inline-flex min-h-12 items-center justify-center rounded-full px-7 text-[1rem] font-medium transition-colors hover:bg-lime-measure hover:text-ink focus-visible:bg-lime-measure focus-visible:text-ink " +
        (variant === "light" ? "bg-warm-white text-ink" : "bg-primary text-primary-foreground") +
        " " +
        className
      }
    >
      {eventConfig.ctaLabel}
    </button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[0.75rem] font-medium tracking-[0.2em] text-muted-foreground uppercase">
      {children}
    </p>
  );
}

function MetrisEventPage() {
  const { status, session_id: sessionId } = Route.useSearch();
  const [chosenPass, setChosenPass] = useState<"executive" | "team">("executive");
  const avail = useAvailability();
  /* Closed administratively, OR sold out according to verified server state.
     The client count is display only — /api/checkout enforces capacity. */
  const closed =
    !eventConfig.registrationOpen || eventConfig.registrationStatus !== "open" || avail.soldOut;

  return (
    <div className="min-h-screen bg-background">
      <SiteNav />

      <main>
        {/* ---------------------------------------------------------- HERO */}
        <Scene id="home" noEnter aria-labelledby="hero-heading" className="relative isolate">
          <img
            src={heroImage}
            alt="Abstract layered planes representing a healthcare organization's governance, workflow, technology, workforce and measurement layers, with fine measurement markers and small gaps between layers."
            width={1920}
            height={1280}
            fetchPriority="high"
            decoding="async"
            className="absolute inset-0 -z-10 size-full object-cover"
          />
          <div aria-hidden className="absolute inset-0 -z-10 bg-ink/62" />
          <div
            aria-hidden
            className="absolute inset-0 -z-10 bg-gradient-to-r from-ink via-ink/75 to-ink/25"
          />

          <div className="mx-auto flex min-h-[100svh] max-w-[1440px] flex-col justify-end px-5 pt-32 pb-16 md:px-10 md:pb-20">
            <div className="max-w-[62rem]">
              <p className="text-[0.75rem] font-medium tracking-[0.2em] text-warm-white/70 uppercase">
                METRIS Healthcare AI Readiness Executive Session
              </p>
              <h1
                id="hero-heading"
                className="mt-7 text-[clamp(2.8rem,13vw,4.6rem)] leading-[0.98] font-light tracking-[-0.03em] text-balance text-warm-white md:text-[clamp(4rem,7.5vw,8.5rem)]"
              >
                Before you scale AI, know what is actually ready.
              </h1>
              <p className="mt-8 max-w-[42rem] text-[1.0625rem] leading-relaxed text-warm-white/80 md:text-[1.25rem]">
                A 90-minute live working session for healthcare executives on measuring
                organizational readiness for one selected AI use case.
              </p>

              <p className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-2 text-[0.9375rem] text-warm-white/70">
                <span>{eventMetaLine}</span>
                <span aria-hidden>·</span>
                <span>Limited attendance</span>
              </p>

              <div className="mt-10 flex flex-col items-start gap-4">
                <p className="text-[1.25rem] font-light tracking-[-0.01em] text-warm-white">
                  {eventConfig.heroPriceLine}
                  <span className="ml-3 text-[0.9375rem] text-warm-white/70">
                    {eventConfig.heroSubline}
                  </span>
                </p>
                <RegisterButton location="hero" variant="light" />
                <p className="max-w-[34rem] text-[0.9375rem] text-warm-white/70">
                  {eventConfig.ctaSubline}
                </p>
              </div>

              <p className="mt-10 max-w-[34rem] border-t border-warm-white/15 pt-6 text-[0.9375rem] text-warm-white/55">
                Not another AI trends webinar. The objective is to move from discussion to evidence.
              </p>
            </div>
          </div>
        </Scene>

        {/* ------------------------------------------------------- PROBLEM */}
        <Scene
          id="problem"
          aria-labelledby="problem-heading"
          className="mx-auto max-w-[1440px] px-5 py-24 md:px-10 md:py-36"
        >
          <div className="grid gap-14 lg:grid-cols-12 lg:gap-10">
            <Reveal className="lg:col-span-7">
              <SectionLabel>The problem</SectionLabel>
              <h2
                id="problem-heading"
                className="mt-7 text-[clamp(2rem,4.6vw,3.6rem)] leading-[1.05] font-light tracking-[-0.02em] text-balance text-foreground"
              >
                Healthcare organizations are adopting AI faster than they can measure whether they
                are ready to use it.
              </h2>
            </Reveal>

            <Reveal className="lg:col-span-5 lg:pt-40" delay={80}>
              <p className="text-[1.0625rem] leading-relaxed text-muted-foreground md:text-[1.1875rem]">
                An AI system can perform technically while the organization around it remains
                unready. Authority may be unclear. The workflow may not support escalation. The
                relevant workforce may not recognize what the situation requires. The expected
                outcome may never have been defined well enough to measure.
              </p>
              <p className="mt-6 text-[1.0625rem] leading-relaxed text-muted-foreground md:text-[1.1875rem]">
                METRIS examines those conditions around one selected AI use case—before another
                investment, rollout, expansion, or operating decision is made.
              </p>
            </Reveal>
          </div>

          <Reveal className="mt-20 border-t border-hairline pt-10 md:mt-28">
            <p className="text-[clamp(1.6rem,3.4vw,2.75rem)] leading-tight font-light tracking-[-0.02em] text-foreground">
              Attend the session.{" "}
              <span className="text-muted-foreground">Select one use case.</span>{" "}
              <span className="underline decoration-lime-measure decoration-4 underline-offset-8">
                Measure it.
              </span>
            </p>
          </Reveal>
        </Scene>

        {/* ---------------------------------------------------- WHY ATTEND */}
        <Scene id="why-attend" aria-labelledby="why-heading" className="bg-paper py-24 md:py-36">
          <div className="mx-auto max-w-[1440px] px-5 md:px-10">
            <Reveal>
              <SectionLabel>Why attend</SectionLabel>
              <h2
                id="why-heading"
                className="mt-7 max-w-[24ch] text-[clamp(2rem,4.4vw,3.4rem)] leading-[1.05] font-light tracking-[-0.02em] text-balance text-foreground"
              >
                Move from AI readiness claims to decision-ready evidence.
              </h2>
            </Reveal>

            <div className="mt-16 grid gap-6 lg:grid-cols-3">
              {[
                {
                  n: "01",
                  t: "See where readiness actually breaks",
                  b: "Understand why technically capable AI implementations can still fail when authority, workflow, evidence, workforce, or measurement conditions are missing.",
                },
                {
                  n: "02",
                  t: "Examine one healthcare use case",
                  b: "Work at the level where implementation decisions actually happen: a specific AI deployment rather than an abstract enterprise maturity score.",
                },
                {
                  n: "03",
                  t: "Move one real use case into measurement",
                  b: "After the session, submit one healthcare AI use case for eligibility review. For an eligible use case, METRIS will conduct a scoped readiness assessment using the measurement components that are validated and applicable to that use case. Assessment scope is confirmed before evidence is requested.",
                },
              ].map((panel, i) => (
                <Reveal
                  key={panel.n}
                  delay={i * 90}
                  className="card-emboss card-emboss-hover flex flex-col rounded-[26px] border border-hairline bg-card p-8 md:p-10"
                >
                  <span className="text-[0.8125rem] font-medium tracking-[0.18em] text-muted-foreground">
                    {panel.n}
                  </span>
                  <h3 className="mt-8 text-[1.5rem] leading-snug font-medium text-balance text-foreground md:text-[1.75rem]">
                    {panel.t}
                  </h3>
                  <p className="mt-5 text-[1.0625rem] leading-relaxed text-muted-foreground">
                    {panel.b}
                  </p>
                </Reveal>
              ))}
            </div>

            <Reveal className="mt-24 border-t border-hairline pt-14 md:mt-32">
              <p className="max-w-[22ch] text-[clamp(1.9rem,4.6vw,3.6rem)] leading-[1.05] font-light tracking-[-0.02em] text-balance text-foreground">
                Your AI works. Is the organization around it ready?
              </p>
              <ul className="mt-14 flex flex-wrap gap-x-10 gap-y-4 text-[0.9375rem] tracking-[0.16em] text-muted-foreground uppercase md:gap-x-16">
                {["Governance", "Workflow", "Technology", "Workforce", "Measurement"].map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </Reveal>
          </div>
        </Scene>

        {/* --------------------------------------------------- MEASUREMENT */}
        <Scene
          id="measurement"
          aria-labelledby="measurement-heading"
          className="mx-auto max-w-[1440px] px-5 py-24 md:px-10 md:py-36"
        >
          <div className="grid gap-12 lg:grid-cols-12">
            <Reveal className="lg:col-span-5">
              <SectionLabel>What METRIS measures</SectionLabel>
              <h2
                id="measurement-heading"
                className="mt-7 text-[clamp(2rem,4.4vw,3.4rem)] leading-[1.05] font-light tracking-[-0.02em] text-foreground"
              >
                Five conditions. One use case.
              </h2>
            </Reveal>
            <Reveal className="lg:col-span-6 lg:col-start-7 lg:pt-6" delay={70}>
              <p className="text-[1.0625rem] leading-relaxed text-muted-foreground md:text-[1.1875rem]">
                METRIS does not label an entire company “AI-ready.” It measures the organizational
                conditions surrounding a selected use case, because readiness for one deployment
                does not prove readiness for another.
              </p>
            </Reveal>
          </div>

          <div className="mt-16 border-t border-hairline">
            {[
              {
                t: "Governance",
                b: "Who is authorized, accountable, and responsible?",
              },
              {
                t: "Workflow",
                b: "How does AI-enabled work actually move through the organization, including exceptions and escalation?",
              },
              {
                t: "Technology",
                b: "Are the systems, data, and dependencies required by the use case present?",
              },
              {
                t: "Workforce",
                b: "Can the relevant role groups recognize and respond to the situations the use case creates?",
              },
              {
                t: "Measurement",
                b: "Has the organization defined the intended outcome and how it will know whether that outcome occurred?",
              },
            ].map((item, i) => (
              <Reveal
                key={item.t}
                delay={i * 60}
                className="grid gap-4 border-b border-hairline py-9 md:grid-cols-12 md:gap-10"
              >
                <div className="flex items-baseline gap-4 md:col-span-4">
                  <span aria-hidden className="text-[0.8125rem] text-muted-foreground">
                    0{i + 1}
                  </span>
                  <h3 className="text-[1.5rem] font-medium text-foreground md:text-[1.875rem]">
                    {item.t}
                  </h3>
                </div>
                <p className="text-[1.0625rem] leading-relaxed text-muted-foreground md:col-span-7 md:col-start-6 md:text-[1.125rem]">
                  {item.b}
                </p>
              </Reveal>
            ))}
          </div>

          <Reveal className="mt-12 max-w-[52rem] rounded-[24px] border border-hairline bg-paper p-8">
            <p className="text-[1.0625rem] leading-relaxed text-foreground">
              The assessment looks at two things: the{" "}
              <strong className="font-medium">governance readiness</strong> of the organization —
              decision authority, escalation, evidence, and oversight — and the{" "}
              <strong className="font-medium">workforce readiness</strong> of the role groups who
              would carry out the work, within the agreed assessment scope.
            </p>
          </Reveal>
        </Scene>

        {/* ------------------------------------------------------ USE CASES */}
        <Scene
          id="use-cases"
          aria-labelledby="use-cases-heading"
          className="bg-paper py-24 md:py-36"
        >
          <div className="mx-auto max-w-[1440px]">
            <Reveal className="px-5 md:px-10">
              <SectionLabel>Use cases</SectionLabel>
              <h2
                id="use-cases-heading"
                className="mt-7 text-[clamp(2rem,4.4vw,3.4rem)] leading-[1.05] font-light tracking-[-0.02em] text-foreground"
              >
                Start with one use case.
              </h2>
              <p className="mt-5 max-w-[44rem] text-[1.0625rem] leading-relaxed text-muted-foreground md:text-[1.1875rem]">
                Readiness becomes measurable when the question becomes specific.
              </p>
            </Reveal>

            <div className="mt-14">
              <UseCaseRail />
            </div>

            <Reveal className="mt-12 px-5 md:px-10">
              <p className="max-w-[58rem] border-t border-hairline pt-7 text-[0.9375rem] leading-relaxed text-muted-foreground">
                These examples illustrate where organizational AI readiness questions arise across
                healthcare. METRIS develops and validates its measurement approach use case by use
                case rather than assuming that one set of checkpoints applies everywhere.
                Post-session assessment eligibility is confirmed after the submitted use case is
                reviewed for scope and measurement coverage.
              </p>
            </Reveal>
          </div>
        </Scene>

        {/* --------------------------------------------------------- AGENDA */}
        <Scene
          id="agenda"
          aria-labelledby="agenda-heading"
          className="mx-auto max-w-[1440px] px-5 py-24 md:px-10 md:py-36"
        >
          <Reveal>
            <SectionLabel>Session agenda</SectionLabel>
            <h2
              id="agenda-heading"
              className="mt-7 text-[clamp(2rem,4.4vw,3.4rem)] leading-[1.05] font-light tracking-[-0.02em] text-foreground"
            >
              The 90-minute session
            </h2>
          </Reveal>

          <div className="mt-16 border-t border-hairline">
            {[
              {
                time: "00–15 min",
                t: "Why “AI-ready” is the wrong question",
                b: "Why readiness must be tied to a specific use case.",
              },
              {
                time: "15–35 min",
                t: "Where organizational readiness breaks",
                b: "Governance, workflow, technology, workforce, and measurement.",
              },
              {
                time: "35–60 min",
                t: "A healthcare use case, measured",
                b: "A concrete walkthrough showing how evidence becomes a readiness finding.",
              },
              {
                time: "60–75 min",
                t: "From readiness finding to executive decision",
                b: "What the evidence can—and cannot—tell leadership.",
              },
              {
                time: "75–90 min",
                t: "Executive discussion and assessment selection",
                b: "Questions, discussion, and instructions for submitting the use case to be considered for assessment.",
              },
            ].map((row, i) => (
              <Reveal
                key={row.time}
                delay={i * 60}
                className="grid gap-3 border-b border-hairline py-9 md:grid-cols-12 md:gap-8"
              >
                <p className="text-[0.9375rem] tracking-[0.06em] text-muted-foreground md:col-span-3">
                  {row.time}
                </p>
                <div className="md:col-span-7">
                  <h3 className="text-[1.375rem] leading-snug font-medium text-balance text-foreground md:text-[1.625rem]">
                    {row.t}
                  </h3>
                  <p className="mt-3 text-[1.0625rem] leading-relaxed text-muted-foreground">
                    {row.b}
                  </p>
                </div>
                <div aria-hidden className="hidden items-center md:col-span-2 md:flex">
                  <span className="h-px w-full bg-hairline" />
                  <span className="ml-2 h-1.5 w-1.5 shrink-0 rounded-full bg-lime-measure" />
                </div>
              </Reveal>
            ))}
          </div>
        </Scene>

        {/* -------------------------------------------------------- INCLUDED */}
        <Scene
          id="included"
          aria-labelledby="included-heading"
          className="bg-ink py-24 text-warm-white md:py-36"
        >
          <div className="mx-auto max-w-[1440px] px-5 md:px-10">
            <Reveal>
              <p className="text-[0.75rem] font-medium tracking-[0.2em] text-warm-white/60 uppercase">
                What registration includes
              </p>
              <h2
                id="included-heading"
                className="mt-7 max-w-[22ch] text-[clamp(2rem,4.4vw,3.4rem)] leading-[1.05] font-light tracking-[-0.02em] text-balance"
              >
                Your registration includes more than the session.
              </h2>
            </Reveal>

            <div className="mt-16 grid gap-6 lg:grid-cols-2">
              <Reveal className="rounded-[26px] border border-warm-white/15 p-8 md:p-10">
                <h3 className="text-[1.5rem] font-medium">During the session</h3>
                <ul className="mt-7 space-y-4 text-[1.0625rem] text-warm-white/75">
                  {[
                    "90-minute live executive working session",
                    "Practical healthcare examples",
                    "METRIS measurement approach",
                    "One use-case walkthrough",
                    "Executive discussion and Q&A",
                  ].map((li) => (
                    <li key={li} className="flex gap-3">
                      <span
                        aria-hidden
                        className="mt-2.5 h-1 w-1 shrink-0 rounded-full bg-lime-measure"
                      />
                      {li}
                    </li>
                  ))}
                </ul>
              </Reveal>

              <Reveal
                delay={90}
                className="rounded-[26px] border border-warm-white/15 bg-teal-deep p-8 md:p-10"
              >
                <h3 className="text-[1.5rem] font-medium">After the session</h3>
                <ul className="mt-7 space-y-4 text-[1.0625rem] text-warm-white/85">
                  {[
                    "Submission of one selected healthcare AI use case for eligibility review",
                    "One scoped METRIS readiness assessment for an eligible use case",
                    "Evidence-backed findings across the METRIS conditions applicable to the agreed scope",
                    "Clear identification of what was established, partly established, unresolved, or not measurable from the available evidence",
                    "Traceability from findings to the evidence and governing basis used in the assessment",
                  ].map((li) => (
                    <li key={li} className="flex gap-3">
                      <span
                        aria-hidden
                        className="mt-2.5 h-1 w-1 shrink-0 rounded-full bg-lime-measure"
                      />
                      {li}
                    </li>
                  ))}
                </ul>
                <p className="mt-7 border-t border-warm-white/15 pt-6 text-[0.9375rem] leading-relaxed text-warm-white/70">
                  The exact assessment scope is confirmed after the use case is reviewed. METRIS
                  does not assume that the same checkpoints, evidence, or workforce measures apply
                  to every healthcare AI deployment.
                </p>
              </Reveal>
            </div>

            <Reveal className="mt-10 rounded-[24px] border border-warm-white/15 p-7">
              <p className="max-w-[62rem] text-[0.9375rem] leading-relaxed text-warm-white/70">
                METRIS provides organizational readiness measurement and evidence. It is not a
                certification, regulatory or legal opinion, technical validation of an AI model, or
                individual employment assessment.
              </p>
            </Reveal>
          </div>
        </Scene>

        {/* -------------------------------------------------------- AUDIENCE */}
        <Scene
          id="audience"
          aria-labelledby="audience-heading"
          className="mx-auto max-w-[1440px] px-5 py-24 md:px-10 md:py-36"
        >
          <div className="grid gap-12 lg:grid-cols-12">
            <Reveal className="lg:col-span-6">
              <SectionLabel>Who should attend</SectionLabel>
              <h2
                id="audience-heading"
                className="mt-7 text-[clamp(2rem,4.4vw,3.4rem)] leading-[1.05] font-light tracking-[-0.02em] text-balance text-foreground"
              >
                Built for people making AI investment and operating decisions.
              </h2>
            </Reveal>
            <Reveal className="lg:col-span-5 lg:col-start-8 lg:pt-4" delay={80}>
              <p className="text-[1.0625rem] leading-relaxed text-muted-foreground md:text-[1.1875rem]">
                Particularly useful if your organization is evaluating a healthcare AI use case,
                preparing for implementation, expanding an existing deployment, questioning whether
                AI investment is producing the expected value, or trying to align technology
                decisions with workforce and operating reality.
              </p>
            </Reveal>
          </div>

          <Reveal className="mt-14">
            <ul className="flex flex-wrap gap-3">
              {[
                "CEO",
                "COO",
                "CIO",
                "CTO",
                "CAIO",
                "CHRO",
                "CFO",
                "Chief Transformation Officer",
                "AI and Data Leaders",
                "Governance Leaders",
              ].map((role) => (
                <li
                  key={role}
                  className="rounded-full border border-hairline px-5 py-2.5 text-[0.9375rem] text-foreground"
                >
                  {role}
                </li>
              ))}
            </ul>
          </Reveal>
        </Scene>

        {/* ----------------------------------------------------------- ABOUT */}
        <Scene id="about" aria-labelledby="about-heading" className="bg-paper py-24 md:py-36">
          <div className="mx-auto max-w-[1440px] px-5 md:px-10">
            <div className="grid gap-12 lg:grid-cols-12">
              <Reveal className="lg:col-span-5">
                <SectionLabel>About</SectionLabel>
                <h2
                  id="about-heading"
                  className="mt-7 text-[clamp(2rem,4.4vw,3.4rem)] leading-[1.05] font-light tracking-[-0.02em] text-foreground"
                >
                  About METRIS
                </h2>
              </Reveal>
              <Reveal className="lg:col-span-6 lg:col-start-7 lg:pt-6" delay={70}>
                <p className="text-[1.0625rem] leading-relaxed text-foreground md:text-[1.1875rem]">
                  METRIS is an organizational AI readiness measurement system designed to answer a
                  deceptively simple question: ready for what?
                </p>
                <p className="mt-6 text-[1.0625rem] leading-relaxed text-muted-foreground md:text-[1.1875rem]">
                  Organizations are often described as “AI-ready” as though readiness were a
                  company-wide characteristic. METRIS takes a different approach. It measures
                  readiness around one selected use case across governance, workflow, technology,
                  workforce, and measurement—because the conditions required for one deployment may
                  be entirely different from another.
                </p>
              </Reveal>
            </div>

            <Reveal className="mt-24">
              <h3 className="text-[1.75rem] font-light tracking-[-0.01em] text-foreground md:text-[2.25rem]">
                Your hosts
              </h3>
              {eventConfig.showHostsIntroLine && (
                <p className="mt-5 max-w-[52rem] text-[1.0625rem] leading-relaxed text-muted-foreground">
                  {eventConfig.hostsIntroLine}
                </p>
              )}
            </Reveal>

            <div className="mt-12 grid gap-6 md:grid-cols-2">
              {eventConfig.hosts.map((host, i) => (
                <Reveal
                  key={host.name}
                  delay={i * 90}
                  className="rounded-[26px] border border-hairline bg-background p-8"
                >
                  <div className="aspect-4/5 w-full max-w-[15rem] overflow-hidden rounded-[18px] bg-paper">
                    {host.photo ? (
                      <img
                        src={host.photo}
                        alt={`Portrait of ${host.name}`}
                        loading="lazy"
                        className="size-full object-cover"
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center p-4 text-center text-[0.8125rem] text-muted-foreground">
                        [UPLOAD APPROVED HEADSHOT]
                      </div>
                    )}
                  </div>
                  <h4 className="mt-7 text-[1.375rem] font-medium text-foreground">{host.name}</h4>
                  <p className="mt-1 text-[0.9375rem] text-muted-foreground">{host.title}</p>
                  <p className="mt-5 text-[1.0625rem] leading-relaxed text-muted-foreground">
                    {host.bio}
                  </p>
                  {host.linkedin && (
                    <a
                      href={host.linkedin}
                      className="mt-5 inline-block text-[0.9375rem] underline underline-offset-4"
                    >
                      LinkedIn
                    </a>
                  )}
                </Reveal>
              ))}
            </div>
          </div>
        </Scene>

        {/* ------------------------------------------------------------- FAQ */}
        <Scene
          id="faq"
          aria-labelledby="faq-heading"
          className="mx-auto max-w-[1440px] px-5 py-24 md:px-10 md:py-36"
        >
          <Reveal>
            <SectionLabel>FAQ</SectionLabel>
            <h2
              id="faq-heading"
              className="mt-7 text-[clamp(2rem,4.4vw,3.4rem)] leading-[1.05] font-light tracking-[-0.02em] text-foreground"
            >
              Questions, answered plainly.
            </h2>
          </Reveal>
          <Reveal className="mt-14">
            <FaqAccordion />
          </Reveal>
        </Scene>

        {/* -------------------------------------------------------- REGISTER */}
        <Scene
          id="register"
          calm
          aria-labelledby="register-heading"
          className="bg-paper py-24 md:py-36"
        >
          <div className="mx-auto max-w-[1440px] px-5 md:px-10">
            {/* The two passes, above the form so the choice is made before the
                details are typed. Availability is verified server state. */}
            {!closed && status !== "success" && (
              <div className="mb-16">
                <PricingSection onChoose={setChosenPass} />
              </div>
            )}
          </div>

          <div className="mx-auto grid max-w-[1440px] gap-14 px-5 md:px-10 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-5">
              <Reveal>
                <SectionLabel>Registration</SectionLabel>
                <h2
                  id="register-heading"
                  className="mt-7 text-[clamp(2rem,4.4vw,3.4rem)] leading-[1.05] font-light tracking-[-0.02em] text-foreground"
                >
                  Measure before you scale.
                </h2>
                <p className="mt-8 text-[1.125rem] text-foreground">{eventConfig.name}</p>
                <p className="mt-3 text-[1.0625rem] text-muted-foreground">{eventMetaLine}</p>
                <p className="mt-10 text-[2.5rem] font-light tracking-[-0.02em] text-foreground">
                  {eventConfig.heroPriceLine}
                </p>
                <p className="mt-5 max-w-[34rem] text-[1.0625rem] leading-relaxed text-muted-foreground">
                  {eventConfig.ctaSubline}
                </p>
              </Reveal>
            </div>

            <div className="lg:col-span-6 lg:col-start-7">
              <Reveal delay={80}>
                {status === "success" ? (
                  <SuccessCard sessionId={sessionId ?? ""} />
                ) : closed ? (
                  <ClosedCard soldOut={avail.soldOut} />
                ) : (
                  <>
                    {status === "cancelled" && (
                      <div
                        role="status"
                        className="mb-6 rounded-[20px] border border-hairline bg-background p-6"
                      >
                        <p className="text-[1.0625rem] font-medium text-foreground">
                          Checkout was cancelled.
                        </p>
                        <p className="mt-2 text-[0.9375rem] text-muted-foreground">
                          No payment was taken and no place is held. You can complete registration
                          below.
                        </p>
                      </div>
                    )}
                    <RegistrationForm selectedPass={chosenPass} />
                  </>
                )}
              </Reveal>
            </div>
          </div>
        </Scene>

        {/* ------------------------------------------------------- FINAL CTA */}
        <Scene aria-labelledby="final-cta-heading" className="relative isolate">
          <img
            src={panelImage}
            alt=""
            aria-hidden
            loading="lazy"
            width={1920}
            height={912}
            className="absolute inset-0 -z-10 size-full object-cover"
          />
          <div aria-hidden className="absolute inset-0 -z-10 bg-ink/80" />
          <div className="mx-auto max-w-[1440px] px-5 py-28 md:px-10 md:py-40">
            <Reveal>
              <h2
                id="final-cta-heading"
                className="max-w-[16ch] text-[clamp(2.4rem,7vw,5.5rem)] leading-[1] font-light tracking-[-0.03em] text-warm-white"
              >
                Measure before you scale.
              </h2>
              <p className="mt-8 text-[1.0625rem] text-warm-white/75 md:text-[1.25rem]">
                90-minute live METRIS Executive Session · {eventConfig.heroPriceLine}
              </p>
              <p className="mt-2 text-[1.0625rem] text-warm-white/60">{eventConfig.ctaSubline}</p>
              <div className="mt-12">
                <RegisterButton location="final_cta" variant="light" />
              </div>
            </Reveal>
          </div>
        </Scene>
      </main>

      <SiteFooter />
    </div>
  );
}

function ClosedCard({ soldOut = false }: { soldOut?: boolean }) {
  return (
    <div className="rounded-[26px] border border-hairline bg-card p-8 md:p-10">
      <h3 className="text-[1.5rem] font-medium text-foreground">
        {soldOut ? "This session is fully booked." : "Registration is currently closed."}
      </h3>
      <p className="mt-4 text-[1.0625rem] leading-relaxed text-muted-foreground">
        Contact {eventConfig.supportEmail} for information about this session or future dates.
      </p>
      <a
        href={`mailto:${eventConfig.supportEmail}`}
        className="mt-8 inline-flex min-h-12 items-center rounded-full bg-primary px-6 text-[1rem] font-medium text-primary-foreground"
      >
        Contact METRIS
      </a>
    </div>
  );
}

type SessionInfo = {
  ok: boolean;
  paid: boolean;
  email?: string;
  name?: string;
  amount?: string;
  currency?: string;
  company?: string;
  error?: string;
};

/* The confirmation state.

   It is handed a Checkout Session id in the address bar, which anyone can
   edit, so it believes nothing until /api/session has asked Stripe. Until that
   answer arrives it shows a checking state, and on anything other than a paid
   session it confirms nothing — and, critically, shows no joining link. */
function SuccessCard({ sessionId }: { sessionId: string }) {
  const [info, setInfo] = useState<SessionInfo | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setFailed("There is no payment reference in this address, so there is nothing to confirm.");
      return;
    }
    let live = true;
    fetch(`/api/session?session_id=${encodeURIComponent(sessionId)}`)
      .then((r) => r.json())
      .then((d: SessionInfo) => {
        if (!live) return;
        if (!d.ok) setFailed(d.error ?? "That payment could not be confirmed.");
        else setInfo(d);
      })
      .catch(() => {
        if (live) setFailed("We could not reach the server to confirm the payment.");
      });
    return () => {
      live = false;
    };
  }, [sessionId]);

  if (!info && !failed) {
    return (
      <div role="status" className="rounded-[26px] border border-hairline bg-card p-8 md:p-10">
        <p className="text-[1.0625rem] text-muted-foreground">Checking your payment…</p>
      </div>
    );
  }

  if (failed || (info && !info.paid)) {
    return (
      <div role="alert" className="rounded-[26px] border border-hairline bg-card p-8 md:p-10">
        <h3 className="text-[1.5rem] font-medium text-foreground">
          {failed ? "We could not confirm that payment." : "That payment has not completed."}
        </h3>
        <p className="mt-4 text-[1.0625rem] leading-relaxed text-muted-foreground">
          {failed ?? "Nothing has been charged and no place is held."}
        </p>
        <p className="mt-3 text-[0.9375rem] leading-relaxed text-muted-foreground">
          If you believe you were charged, nothing is lost — email {eventConfig.supportEmail} with
          this page open and we will sort it out.
        </p>
        <Link
          to="/"
          className="mt-8 inline-flex min-h-12 items-center rounded-full border border-input px-6 text-[1rem] font-medium text-foreground"
        >
          Return to event page
        </Link>
      </div>
    );
  }

  const paid = info as SessionInfo;
  const factsKnown = !isPlaceholder(eventConfig.date);

  return (
    <div role="status" className="rounded-[26px] border border-hairline bg-card p-8 md:p-10">
      <h3 className="text-[1.875rem] font-light tracking-[-0.02em] text-foreground">
        Your payment is confirmed.
      </h3>
      <p className="mt-4 text-[0.9375rem] text-muted-foreground">
        {paid.amount} {paid.currency} paid{paid.email ? ` · ${paid.email}` : ""}
      </p>

      {eventConfig.confirmationEmailConfigured ? (
        <p className="mt-5 text-[1.0625rem] leading-relaxed text-muted-foreground">
          A confirmation has been sent to the email address you provided. Instructions for
          submitting your use case will follow at the appropriate stage.
        </p>
      ) : (
        <p className="mt-5 text-[1.0625rem] leading-relaxed text-muted-foreground">
          Please keep your payment receipt as proof of registration. Confirmation email delivery is
          not yet configured, so nothing has been emailed to you. Contact {eventConfig.supportEmail}{" "}
          with any questions.
        </p>
      )}

      {/* Joining credentials are NOT shown here and never will be. Each named
          attendee receives their own Zoom registration at their own address,
          so there is no link this page could display that would be safe to
          display. */}
      <p className="mt-8 rounded-[16px] bg-paper p-5 text-[0.9375rem] leading-relaxed text-muted-foreground">
        Joining instructions will be sent to each verified attendee by email. They are individual
        and must not be shared or posted publicly.
      </p>

      {!factsKnown && (
        <p className="mt-5 text-[0.9375rem] text-muted-foreground">
          Add to calendar (.ics, Google, Outlook) becomes available once the event date and time are
          confirmed.
        </p>
      )}

      <Link
        to="/"
        className="mt-8 inline-flex min-h-12 items-center rounded-full border border-input px-6 text-[1rem] font-medium text-foreground"
      >
        Return to event page
      </Link>
    </div>
  );
}
