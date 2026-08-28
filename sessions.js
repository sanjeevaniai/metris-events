/* THE ONLY FILE YOU EDIT TO CHANGE A GROUP, A SESSION, A SEAT OR A QUESTION.
   ==========================================================================

   Loads in a browser (window.METRIS) and in the Vercel functions (require).
   No bundler is involved.

   TO ADD A GROUP: add an entry to GROUPS. Nothing else in the repo needs
   touching - the group page is one template served at /group-<slug> by the
   rewrite in vercel.json. The one thing this file cannot do for you is create
   the Stripe price; make it in the dashboard first and paste its id here.

   ANYTHING NOT YET DECIDED IS null, NEVER "" OR A GUESS. Null renders on the
   page as visibly missing. An empty string would render as though it were
   settled, which is the failure worth avoiding.

   TIMES ARE STORED ONCE, as a date and a wall-clock time in Central. The other
   zones and the daylight-saving abbreviation are computed from the date at
   render time by time.js. Never store four times.

   THE STRIPE PRICE IDS BELOW ARE TEST-MODE OBJECTS. They exist only in the
   sandbox and will NOT resolve against a live key: with sk_live_ set, every
   group refuses by name and no payment can be taken. They are here so the flow
   can be exercised end to end before launch, and they must be replaced.

   Before launch, Suneeta creates the live products and prices in Stripe and
   supplies the ids. Nothing in this repo may create them.
   ========================================================================== */

(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.METRIS = factory();
})(typeof self !== "undefined" ? self : this, function () {

  var PRICE = { amount: 249, display: "$249", currency: "usd" };

  /* THE JOINING LINK IS NOT IN THIS FILE, AND MUST NOT BE PUT IN IT.
     Every visitor downloads this file, so anything in it is public. The link is
     held server side and released only after a payment has been confirmed with
     the payment processor. See api/_private.js, which the browser never loads. */

  var TIMEZONE = "America/Chicago";          /* stored zone; CDT/CST follows the date */
  var ZONES = [                              /* shown together at render time */
    { tz: "America/New_York", label: "Eastern" },
    { tz: "America/Chicago",  label: "Central" },
    { tz: "America/Denver",   label: "Mountain" },
    { tz: "America/Los_Angeles", label: "Pacific" }
  ];

  var SEATS = [
    {
      id: "ceo",
      label: "CEO or Founder",
      group: "a",
      q: "What AI decision is in front of you in the next two quarters?",
      multi: true,
      other: true,
      exclusive: ["Nothing decided yet", "Not sure"],
      options: [
        "Whether to spend more",
        "Whether to put AI in front of customers",
        "Whether to build or buy",
        "Whether to slow down until we understand the risk",
        "Nothing decided yet",
        "Not sure"
      ]
    },
    {
      id: "cfo",
      label: "CFO or Finance",
      group: "c",
      q: "What visibility do you have into the ROI of your AI implementation?",
      exclusive: ["Not sure"],
      options: [
        "We have not yet implemented AI",
        "We are in the AI pilot stage and will formulate AI financial measures",
        "AI is being implemented and we track AI license expenditures and token usage/cost",
        "AI expenses and usage are tracked in divisions, departments, or teams and we still have more work to do",
        "We track AI spend in a structured way and also track AI ROI",
        "Not sure"
      ]
    },
    {
      id: "cto",
      label: "CTO, CIO or Engineering",
      group: "b",
      q: "Once an AI system is live, how do you know it is doing what you intended?",
      multi: true,
      exclusive: ["We do not have a good answer yet", "Not sure"],
      options: [
        "We hear about it when something breaks",
        "Someone checks the outputs by hand",
        "We monitor the model",
        "We monitor the decisions it affects",
        "We do not have a good answer yet",
        "Not sure"
      ]
    },
    {
      id: "ciso",
      label: "CISO or Security",
      group: "b",
      q: "How do you track AI usage, and what controls are in place for its implementation?",
      multi: true,
      exclusive: ["Not sure"],
      options: [
        "We have some controls and we’re in the process of developing more",
        "We know there is AI usage in our organization but don’t specifically track where AI agents are running",
        "We have documented clear guidelines and perform audits to ensure compliance",
        "We have some policies in place but they may be inadequate for the future",
        "We do not allow unauthorized AI usage",
        "Not sure"
      ]
    },
    {
      id: "chro",
      label: "CHRO or People",
      group: "c",
      q: "How have you included AI in your people or talent strategy?",
      multi: true,
      exclusive: ["We do not have a talent or people strategy", "Not sure"],
      options: [
        "We do not have a talent or people strategy",
        "We provide training on how to use AI",
        "We evaluate our organization’s overall and departmental AI readiness",
        "We do not specifically call out AI in our talent or people strategy",
        "We have productivity measures and know the impact AI makes in terms of quality, labor needs, and efficiency",
        "Not sure"
      ]
    },
    {
      id: "coo",
      label: "COO or Operations",
      group: "a",
      q: "What operational approach do you use to guide AI implementation?",
      multi: true,
      exclusive: [
        "We do not have a well defined operational approach for AI implementation",
        "Not sure"
      ],
      options: [
        "Divisions, departments, or areas determine where to apply AI",
        "We have a governing process that prioritizes which processes should be improved with AI",
        "We track quality and time to determine processes to improve",
        "We have an overall AI implementation map based on operational needs",
        "We do not have a well defined operational approach for AI implementation",
        "Not sure"
      ]
    },
    {
      id: "risk",
      label: "Risk, Compliance or Legal",
      group: "c",
      q: "What accountability does your organization have for AI results and outcomes?",
      multi: true,
      other: true,
      exclusive: ["We have not yet created specific AI expectations and outcomes", "Not sure"],
      options: [
        "We have a general expectation that AI will generate positive results",
        "There are documented expected outcomes tied to financial outcomes and productivity improvement",
        "Each division, department, or area is responsible for tracking results",
        "We have some documented expectations for AI outcomes",
        "We have not yet created specific AI expectations and outcomes",
        "Not sure"
      ]
    },
    {
      id: "data",
      label: "Data and AI leadership",
      group: "b",
      q: "What process do you have to organize and structure AI implementation?",
      multi: true,
      other: true,
      exclusive: [
        "We do not have a structured governance and tracking process for AI",
        "Not sure"
      ],
      options: [
        "We have processes to stop unauthorized AI usage",
        "We encourage AI usage and have basic guidelines",
        "We have some AI governance but it’s not as organized as it should be",
        "We do not have a structured governance and tracking process for AI",
        "Our governance process is less than adequate",
        "Not sure"
      ]
    },
    {
      id: "other",
      label: "Another seat",
      group: null,
      freeText: true,
      q: "What brought you to this session?",
      textarea: true,
      placeholder: "A sentence is plenty."
    }
  ];

  var SHARED_QUESTIONS = {
    q1: {
      label: "Where is AI in your organization right now?",
      multi: true,
      exclusive: ["Not started", "Not sure"],
      options: [
        "Not started",
        "People are using tools on their own",
        "Piloting in one or two functions",
        "Running in production",
        "Spreading across functions",
        "Not sure"
      ]
    },
    q2: {
      label: "Who makes organization wide AI decisions?",
      multi: true,
      other: true,
      exclusive: [
        "Nobody yet",
        "Still working that out",
        "No single owner",
        "Still being decided",
        "Not sure"
      ],
      options: [
        "One named executive",
        "A committee or working group",
        "IT or engineering, by default",
        "No single owner",
        "Still being decided",
        "Not sure"
      ]
    }
  };

  var GROUPS = [
    {
      slug: "group-a",
      letter: "A",
      seats: ["ceo", "coo"],
      /* TEST MODE ONLY - replace before launch. See the note at the top.
         Until a real id is here this group cannot take payment, and
         api/checkout.js refuses by name rather than charging a wrong price. */
      stripePriceId: "price_1U9Fns3jDOmjx0I3PKkD5gBN",
      copy: {
        room: null,        /* the line naming who this room is for */
        lede: null,        /* the session copy for this group */
        body: null         /* supplied per group; renders as missing until then */
      },
      figure: null,        /* the interactive component reads this */
      sessions: [
        { layer: 1, date: "2026-09-30", startCentral: "11:00", minutes: 90 },
        { layer: 2, date: "2026-11-04", startCentral: "11:00", minutes: 45 },
        { layer: 3, date: "2027-01-13", startCentral: "11:00", minutes: 45 }
      ]
    },
    {
      slug: "group-b",
      letter: "B",
      seats: ["cto", "ciso", "data"],
      /* TEST MODE ONLY - replace before launch */
      stripePriceId: "price_1U9Fnt3jDOmjx0I3s90g7C1G",
      copy: { room: null, lede: null, body: null },
      figure: null,
      sessions: [
        { layer: 1, date: "2026-10-14", startCentral: "11:00", minutes: 90 },
        { layer: 2, date: "2026-11-11", startCentral: "11:00", minutes: 45 },
        { layer: 3, date: "2027-01-20", startCentral: "11:00", minutes: 45 }
      ]
    },
    {
      slug: "group-c",
      letter: "C",
      seats: ["chro", "cfo", "risk"],
      /* TEST MODE ONLY - replace before launch */
      stripePriceId: "price_1U9Fnt3jDOmjx0I3ffiWgQ34",
      copy: { room: null, lede: null, body: null },
      figure: null,
      sessions: [
        { layer: 1, date: "2026-10-28", startCentral: "11:00", minutes: 90 },
        { layer: 2, date: "2026-11-18", startCentral: "11:00", minutes: 45 },
        { layer: 3, date: "2027-01-27", startCentral: "11:00", minutes: 45 }
      ]
    }
  ];

  var LAYERS = {
    1: { name: "Layer one" },
    2: { name: "Layer two" },
    3: { name: "Layer three" }
  };

  /* ---- lookups. Seat is the source of truth; group is only ever derived. ---- */

  function seat(id) {
    for (var i = 0; i < SEATS.length; i++) if (SEATS[i].id === id) return SEATS[i];
    return null;
  }
  function group(slug) {
    for (var i = 0; i < GROUPS.length; i++) if (GROUPS[i].slug === slug) return GROUPS[i];
    return null;
  }
  /* the one permitted direction: seat -> group */
  function groupForSeat(seatId) {
    var s = seat(seatId);
    if (!s || !s.group) return null;
    return group("group-" + s.group);
  }
  function seatsOf(g) {
    return (g.seats || []).map(seat).filter(Boolean);
  }
  function sessionSlug(g, session) {
    return g.slug + "-layer-" + session.layer;
  }

  return {
    PRICE: PRICE,
    TIMEZONE: TIMEZONE,
    ZONES: ZONES,
    SEATS: SEATS,
    SHARED_QUESTIONS: SHARED_QUESTIONS,
    GROUPS: GROUPS,
    LAYERS: LAYERS,
    seat: seat,
    group: group,
    groupForSeat: groupForSeat,
    seatsOf: seatsOf,
    sessionSlug: sessionSlug
  };
});
