# METRIS Executive Session — single-page event site

## Important limitation up front

Lovable Cloud is currently disabled for your account, so I cannot build the database (`registrations` table) or the server-side Stripe checkout + webhook flow described in sections 5–6. To enable it: Connectors → Lovable Cloud → Tool Permissions → set "Enable Lovable Cloud" to "Always allow" or "Ask each time", then ask again.

What I will build now is the complete, production-quality front end with the registration form fully implemented (validation, states, accessibility, preserved entries) and a single, clearly documented integration seam (`submitRegistration`) that today either (a) redirects to a founder-supplied hosted Stripe Payment Link if you give me one, or (b) shows an honest "payment integration not yet configured" state. No fake success, no forged payment status.

Also: no reference screenshots came through with the message. I'll work from your written description of the Pioneer-by-Fin qualities (restraint, oversized type, sticky nav, sections rising into view) and give METRIS its own visual idea.

## Visual direction

One design idea: **measurement revealing the operating system around healthcare AI.** Muted architectural surfaces, hairline rules, oversized light-weight type, generous asymmetric editorial layout, a lime measurement accent used sparingly as tick-marks and active indicators.

- Tokens centralized in `src/styles.css` (oklch): ink `#111318`, warm white `#F7F6F2`, paper `#ECECE7`, muted slate `#747B86`, deep teal `#173F42`, measurement lime `#C9E46B`, hairline border.
- Type: Manrope (headings + body) loaded via `<link>` in `__root.tsx`. Hero `clamp(4rem, 7.5vw, 8.5rem)` desktop / `clamp(2.8rem, 13vw, 4.6rem)` mobile. Body 17–20px desktop, ≥16px mobile.
- Max width 1440px, cards with hairline borders and 18–28px radii, minimal shadow.
- Hero: generated original abstract "organizational layers / measurement grid" visual (no robots, brains, circuits, stock hospital imagery), dark quiet zones for contrast, overlay for readability, marked as replaceable.

## Page structure

Single route at `/` (replacing the placeholder index) with anchored sections in the exact order and with the exact copy you supplied: hero, problem, why-attend, measurement, use-cases, agenda, included, audience, about, faq, register, final CTA + footer.

- Sticky nav: wordmark left, Home · Why Attend · What We Measure · Use Cases · About center (desktop), `Register — $249` right. Mobile: wordmark, menu toggle, persistent CTA. Scroll-margin on section headings so the sticky bar never covers them.
- Active-section dot via IntersectionObserver; smooth scroll.
- Reveal animation: fade + 20px rise, ~600ms, once per section, fully disabled under `prefers-reduced-motion`.
- Use-case rail: horizontal snap scroller with accessible prev/next buttons, no autoplay; per-card status label ("Assessment-ready now" / "Discussion example") driven by config data, plus the verbatim truth-boundary paragraph beneath.
- FAQ: accessible single-open accordion (keyboard, `aria-expanded`, `aria-controls`).
- All placeholder facts render as visible bracketed tokens, e.g. `[EVENT DATE]`, not invented values.

## Configuration

`src/config/event.ts` — one exported object holding: event name, date, start/end time, time zone, price + currency, capacity, registration status (`open | closed | sold_out`), checkout URL or price id, support email, hosts (name/title/bio/photo/LinkedIn), use cases with status labels, recording policy, refund policy URL, legal entity name, canonical URL, OG image. Every section reads from here.

## Registration section

Editorial two-column. Left: pricing/what's included. Right: form with first name, last name, business email, job title, organization, organization type, country, optional preliminary use case (with explicit "do not enter PHI, patient/member data, or confidential details" helper text), required terms checkbox, optional unchecked marketing consent.

- Zod validation, inline errors + accessible error summary, focus management, entries preserved on error, duplicate-submit prevention, loading state.
- States implemented and reachable: open, closed (shows approved contact email — no waitlist claim), sold out (only if capacity set), submitting, integration-unavailable/retry, validation error.
- Success view (`?status=success`) shows "Your place is confirmed." but only claims an email/calendar was sent when that integration exists; otherwise an accurate fallback. Cancelled view (`?status=cancelled`) offers retry. Success state never marks a payment paid client-side — it only reflects what the provider returns once the backend exists.

## Legal routes

`/privacy`, `/terms`, `/refund-policy`, `/contact` — real routes, each clearly banner-marked "Draft — pending founder approval", no boilerplate presented as approved text.

## SEO & accessibility

Route `head()`: title "METRIS Healthcare AI Readiness Executive Session", your supplied meta description, og/twitter tags, canonical from config. No Event/Organization JSON-LD until the facts are confirmed (documented as pending). Semantic landmarks, single H1, correct heading order, visible focus rings, WCAG AA contrast, descriptive/empty alt text, lazy-loaded below-fold imagery.

## Analytics

A thin `track(event, props)` shim with the specified events (`cta_register_click`, `registration_form_started`, `registration_form_error`, `checkout_started`, `checkout_completed`, `checkout_cancelled`, `faq_opened`, `use_case_card_viewed`). It no-ops until a provider is configured and never receives names, emails, or free text.

## Deliverable

At the end I'll list every remaining placeholder, missing asset, credential, and founder decision — including the Cloud/Stripe/database work that stays blocked until Lovable Cloud is enabled.
