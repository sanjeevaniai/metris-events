export const NAV_ITEMS = [
  { id: "home", label: "Home" },
  { id: "why-attend", label: "Why Attend" },
  { id: "measurement", label: "What We Measure" },
  { id: "use-cases", label: "Use Cases" },
  { id: "about", label: "About" },
] as const;

export const ALL_SECTION_IDS = [
  "home",
  "problem",
  "why-attend",
  "measurement",
  "use-cases",
  "agenda",
  "included",
  "audience",
  "about",
  "faq",
  "register",
] as const;

/** Smooth-scrolls to a section, respecting reduced-motion. */
export function scrollToSection(id: string) {
  if (typeof document === "undefined") return;
  const el = document.getElementById(id);
  if (!el) return;
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  // Move keyboard focus so navigation is usable without a mouse.
  el.setAttribute("tabindex", "-1");
  el.focus({ preventScroll: true });
}
