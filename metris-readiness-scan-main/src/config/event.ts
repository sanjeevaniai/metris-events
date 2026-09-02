/**
 * METRIS — single source of truth for every event-specific fact.
 *
 * Values written as [BRACKETED TEXT] are UNAPPROVED PLACEHOLDERS. They render
 * visibly on the page so nothing invented is ever published as a real claim.
 * Replace them here — no layout changes are required.
 */

export type RegistrationStatus = "open" | "closed" | "sold_out";

export type UseCaseStatus = "assessment_ready" | "discussion_example";

export interface Host {
  name: string;
  title: string;
  bio: string;
  photo: string | null;
  linkedin: string | null;
}

export interface UseCase {
  id: string;
  title: string;
  body: string;
  status: UseCaseStatus;
  /** Small label on the card. Used to mark the one worked example rather than
   *  to imply anything about the others. null on every other card. */
  note?: string | null;
  /** Detail-view content. Bracketed values are unapproved placeholders. */
  detail: {
    /** The decision or workflow involved. */
    decision: string;
    /** Why organizational readiness can break. */
    breakage: string;
    /** What METRIS measures for your systems and your workforce. */
    measures: string;
    /** Relevant teams or role groups. */
    roles: string[];
    /** Assessment availability. */
    availability: string;
    /** Scope and eligibility boundary. */
    boundary: string;
  };
}

const DEFAULT_DETAIL = {
  measures:
    "[INSERT APPROVED DESCRIPTION: what METRIS measures for your systems and your workforce for this use case.]",
  availability: "Assessment eligibility and scope are confirmed after use-case submission.",
  boundary:
    "METRIS provides organizational readiness measurement and evidence. It is not certification, legal advice, or a regulatory compliance opinion, and it does not evaluate individual employees.",
};

export const USE_CASE_STATUS_LABEL: Record<UseCaseStatus, string> = {
  assessment_ready: "Assessment-ready now",
  discussion_example: "Discussion example",
};

export const eventConfig = {
  // --- Session -------------------------------------------------------------
  name: "METRIS Healthcare AI Readiness Executive Session",
  shortName: "METRIS Executive Session",
  date: "October 14, 2026",
  startTime: "[START TIME]",
  endTime: "[END TIME]",
  timeZone: "[TIME ZONE]",
  durationMinutes: 90,
  format: "Live online",

  // --- Commercial ----------------------------------------------------------
  /* TWO PASSES. Price and included places are declared here and resolved again
     on the server from STRIPE_PRICE_EXECUTIVE / STRIPE_PRICE_TEAM. The browser
     posts a pass ID and nothing else — never a price, a currency or a seat
     count — so a tampered client cannot change what is charged or how much
     capacity is consumed. See src/server/passes.ts. */
  passes: {
    executive: {
      id: "executive",
      name: "Executive Pass",
      price: 249,
      priceLabel: "$249",
      currency: "USD",
      /** Named attendees included. Also the capacity this pass consumes. */
      places: 1,
      tagline: "For one healthcare executive or leader",
      priceEnvVar: "STRIPE_PRICE_EXECUTIVE",
      cta: "Choose Executive Pass",
      includes: [
        "One named attendee",
        "Individual Zoom registration and joining credentials",
        "Live 90-minute executive session",
        "One eligible readiness assessment per verified organization",
      ],
    },
    team: {
      id: "team",
      name: "Organization Team Pass",
      price: 1125,
      priceLabel: "$1,125",
      currency: "USD",
      /* Five places are consumed even when fewer names are supplied up front.
         The unused ones are assigned later through an organizer-approved
         process; they are NOT resold. */
      places: 5,
      tagline: "For up to five named attendees from the same organization",
      priceEnvVar: "STRIPE_PRICE_TEAM",
      cta: "Choose Team Pass",
      includes: [
        "Five reserved attendee places",
        "Individual registration and joining credentials for every attendee",
        "Live 90-minute executive session",
        "One eligible readiness assessment for the organization",
      ],
    },
  },

  /** Shown wherever more than five places are needed. */
  moreThanFiveLine: "Need more than five attendee places? Contact METRIS.",

  ctaLabel: "Choose your pass",
  heroPriceLine: "Passes from $249",
  heroSubline: "Attend individually or bring a verified five-person team.",
  ctaSubline: "Includes one eligible use-case readiness assessment per verified organization.",

  // --- Capacity ------------------------------------------------------------
  /* Measured in NAMED ATTENDEE PLACES, not in transactions. An Executive Pass
     consumes 1; a Team Pass consumes 5.

     The buffer is the difference between what Zoom can hold and what may be
     sold through self-service. It exists so that host, panelist, support and
     manually-approved places always fit, and it is never sold. */
  zoomPlatformCapacity: 500,
  publicSaleableCapacity: 450,
  operatingBuffer: 50,

  /* The administrative switch. Closes registration BEFORE capacity is reached,
     independently of how many places remain. Capacity exhaustion is a separate
     condition — see src/server/capacity.ts. */
  registrationOpen: true,

  /** "open" | "closed" | "sold_out" */
  registrationStatus: "open" as RegistrationStatus,

  /**
   * Checkout is server-side. src/routes/api/checkout.ts creates a Stripe
   * Checkout Session from STRIPE_PRICE_ID and redirects there, so there is no
   * checkout URL or price id in this file and none is ever shipped to the
   * browser. Raw card data is never collected or stored by this application,
   * and payment status is never set from a client-side redirect — the
   * confirmation card asks Stripe through /api/session.
   *
   * The price below is what the PAGE advertises. src/routes/api/checkout.ts
   * refuses to charge if the Stripe price disagrees with it.
   */

  /** True once the confirmation email actually sends. It does: the Stripe
   *  webhook sends it through Resend. Set false again only if RESEND_API_KEY
   *  and EMAIL_FROM are unset in the deployed environment, or the success
   *  card will promise an email nobody receives. */
  confirmationEmailConfigured: true,

  // --- Contact / legal -----------------------------------------------------
  supportEmail: "[APPROVED EMAIL]",
  legalEntityName: "[LEGAL ENTITY NAME]",
  refundPolicyUrl: "/refund-policy",
  privacyUrl: "/privacy",
  termsUrl: "/terms",
  linkedinUrl: null as string | null,

  // --- Policies ------------------------------------------------------------
  recordingPolicy: "[FOUNDER DECISION REQUIRED: insert the approved recording and replay policy.]",

  // --- SEO -----------------------------------------------------------------
  canonicalUrl: "/",
  ogImage: null as string | null,

  /** Analytics provider key. null => tracking no-ops. */
  analyticsProvider: null as string | null,

  // --- People --------------------------------------------------------------
  /** Only shown when both approved biographies support it. */
  showHostsIntroLine: false,
  hostsIntroLine:
    "The session brings together perspectives across AI governance, measurement, healthcare operations, and organizational implementation.",

  hosts: [
    {
      name: "Suneeta Modekurty",
      title: "Founder, METRIS",
      bio: "[INSERT APPROVED 35–55 WORD BIO]",
      photo: null,
      linkedin: null,
    },
    {
      name: "[COLLEAGUE NAME]",
      title: "[APPROVED TITLE]",
      bio: "[INSERT APPROVED 35–55 WORD BIO]",
      photo: null,
      linkedin: null,
    },
    {
      name: "[HOST 3 NAME]",
      title: "[APPROVED TITLE]",
      bio: "[INSERT APPROVED 35–55 WORD BIO]",
      photo: null,
      linkedin: null,
    },
    {
      name: "[HOST 4 NAME]",
      title: "[APPROVED TITLE]",
      bio: "[INSERT APPROVED 35–55 WORD BIO]",
      photo: null,
      linkedin: null,
    },
  ] as Host[],

  // --- Use cases -----------------------------------------------------------
  useCases: [
    {
      id: "prior-auth",
      title: "AI-assisted prior authorization",
      body: "Can the organization support the authority, evidence, workflow, human-review, and oversight conditions surrounding an AI-assisted coverage decision?",
      status: "assessment_ready",
      note: "Primary worked use case in the session.",
      detail: {
        decision:
          "Reviewing and deciding authorization requests, including how an AI-assisted recommendation enters the review path.",
        breakage:
          "Decision authority, escalation routes, and documentation expectations are often undefined once part of the review is AI-assisted.",
        roles: ["Clinical leadership", "Utilization review", "Compliance", "Operations"],
        ...DEFAULT_DETAIL,
      },
    },
    {
      id: "claims",
      title: "AI-assisted claims operations",
      body: "Are systems, controls, responsibilities, workforce procedures, and measurement conditions aligned with the role assigned to AI in claims processing?",
      status: "discussion_example",
      detail: {
        decision:
          "Processing, routing, and adjudicating claims where AI assists with classification, review, or exception handling.",
        breakage:
          "Controls and responsibilities stay attached to the previous process while the work itself has changed.",
        roles: ["Claims operations", "Finance", "Compliance", "Data and analytics"],
        ...DEFAULT_DETAIL,
      },
    },
    {
      id: "communications",
      title: "Patient or member communications",
      body: "Who remains accountable when AI generates, prioritizes, summarizes, or modifies information communicated to a patient or member?",
      status: "discussion_example",
      detail: {
        decision:
          "Generating, prioritizing, summarizing, or modifying outbound communication to patients or members.",
        breakage:
          "Accountability for content, tone, and timing becomes unclear once messages are machine-generated at scale.",
        roles: ["Member or patient experience", "Marketing", "Compliance", "Operations"],
        ...DEFAULT_DETAIL,
      },
    },
    {
      id: "clinical-documentation",
      title: "Clinical documentation AI",
      body: "Is the organization prepared for how AI-generated documentation enters human review, correction, escalation, and downstream clinical or administrative workflows?",
      status: "discussion_example",
      detail: {
        decision:
          "Producing, reviewing, and correcting clinical documentation that an AI system drafts or summarizes.",
        breakage:
          "Review and correction steps are assumed rather than defined, and downstream users cannot tell what was verified.",
        roles: ["Clinical leadership", "Informatics", "Quality", "Compliance"],
        ...DEFAULT_DETAIL,
      },
    },
  ] as UseCase[],

  /**
   * Set true once the founder confirms which use cases are assessment-ready.
   * While false, no status badges are shown at all (nothing is implied).
   */
  useCaseStatusConfirmed: true,
} as const;

export type EventConfig = typeof eventConfig;

/* ------------------------- how the date is shown -------------------------

   Nothing below ever prints a bracketed placeholder at a visitor. There are
   three honest states, not two, because the date is now fixed but the start
   time and time zone are not:

     date and time known    "October 14, 2026 · 11:00 AM CT · Live online"
     date known only        "October 14, 2026 · Time to be announced · Live online"
     neither known          "Date to be announced · Live online"

   One string, used by the page, the registration flow and the confirmation
   email, so the three cannot drift apart.

   Calendar links and .ics files are deliberately NOT generated until the date,
   start time and time zone are ALL real — a calendar entry with an invented
   time is worse than no calendar entry. Gate that work on eventTimeKnown. */

/** True for an unapproved placeholder like "[START TIME]", which renders
 *  visibly on the page so nothing invented is published as a real claim. */
export const isPlaceholder = (value: string) => /^\[.*\]$/.test(value.trim());

/** True once the calendar date is a real value. */
export const eventDateKnown = !isPlaceholder(eventConfig.date);

/** True once the date AND the clock time AND the zone are all real. The only
 *  condition under which a calendar link may be generated. */
export const eventTimeKnown =
  eventDateKnown &&
  ![eventConfig.startTime, eventConfig.endTime, eventConfig.timeZone].some(isPlaceholder);

const WHEN = eventTimeKnown
  ? `${eventConfig.startTime}–${eventConfig.endTime} ${eventConfig.timeZone}`
  : "Time to be announced";

/** The one date sentence, used everywhere a visitor sees when this happens. */
export const eventMetaLine = eventDateKnown
  ? [eventConfig.date, WHEN, eventConfig.format].join(" · ")
  : `Date to be announced · ${eventConfig.format}`;

/** The same fact for the confirmation email's "When:" line — the same string,
 *  so the email and the page cannot disagree. */
export const eventWhenLine = eventMetaLine;
