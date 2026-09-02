# METRIS event site — outstanding inputs and integration notes

Everything below is unresolved. Nothing here has been invented or filled in with
plausible-looking content. All editable values live in `src/config/event.ts`.

## Blocked: backend work

Lovable Cloud is disabled for this account, so the following were NOT built:

- `registrations` table (least-privilege, no public read policy)
- server-side registration record creation tied to a checkout session
- Stripe Checkout session creation
- signed webhook that flips `payment_status` to paid
- abuse protection / rate limiting on the registration endpoint
- confirmation email + `.ics` calendar delivery

Enable it via Connectors → Lovable Cloud → Tool Permissions, then request the backend.

Until then: submitting the form does **not** store data and does **not** reserve a
place. With `checkoutUrl` set to a hosted Stripe Payment Link, the form hands off to
that hosted page; with it `null`, the form shows an honest "payment not connected"
message. Payment status is never set from a client-side redirect.

## Founder inputs still required

| Item | Where |
| --- | --- |
| Final session name | `eventConfig.name` |
| Event date, start/end time, time zone | `eventConfig.date/startTime/endTime/timeZone` |
| Maximum attendance (if any) | `eventConfig.capacity` |
| Approved METRIS logo and favicon | `public/favicon.ico`, wordmark in `SiteNav`/`SiteFooter` |
| Final hero image | `src/assets/hero-metris.jpg` (placeholder abstract) |
| Suneeta's approved bio + headshot | `eventConfig.hosts[0]` |
| Colleague name, title, bio, headshot | `eventConfig.hosts[1]` |
| Whether the hosts intro line is accurate | `eventConfig.showHostsIntroLine` |
| Which use cases are assessment-ready | `eventConfig.useCases[].status` + `useCaseStatusConfirmed` |
| Post-session assessment scope / entitlement policy | `/terms` draft |
| Recording / replay policy | `eventConfig.recordingPolicy` |
| Refund and cancellation policy | `/refund-policy` draft |
| Legal entity name | `eventConfig.legalEntityName` |
| Contact / support email | `eventConfig.supportEmail` |
| Privacy Policy and Terms text | `/privacy`, `/terms` drafts |
| Stripe account, price ID, webhook, success/cancel URLs | `eventConfig.checkoutUrl` / `stripePriceId` |
| Confirmation email provider and copy | `eventConfig.confirmationEmailConfigured` |
| Final event URL and social sharing image | `eventConfig.canonicalUrl`, `eventConfig.ogImage` |
| Approved LinkedIn URL | `eventConfig.linkedinUrl` |
| Analytics provider | `eventConfig.analyticsProvider` + `src/lib/analytics.ts` |

## Deliberate omissions

- **No Event/Organization JSON-LD.** Structured data is withheld until every event fact
  is confirmed; placeholders must never ship inside structured data.
- **No og:image tag.** No approved absolute image URL exists yet.
- **No use-case status badges.** They stay hidden until `useCaseStatusConfirmed` is true,
  so nothing implies an eligibility METRIS has not confirmed.
- **No testimonials, logos, statistics, attendee counts, partner or customer claims,
  countdown timers, or pop-ups.**
- **Legal routes are noindexed** and banner-marked as drafts.

## Testable states

| State | How to reach |
| --- | --- |
| Registration open | default |
| Registration closed | `registrationStatus: "closed"` |
| Sold out | `registrationStatus: "sold_out"` **and** `capacity` set |
| Payment processing | submit a valid form with `checkoutUrl` set |
| Payment success | `/?status=success` |
| Payment cancelled | `/?status=cancelled` |
| Validation error | submit an empty form |
| Integration unavailable | submit a valid form with `checkoutUrl: null` |
| Reduced motion | OS "reduce motion" setting |
| Mobile nav | viewport < 1024px |
