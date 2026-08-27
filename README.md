# metris-events

Static event pages for SANJEEVANI AI, served at https://events.sanjeevaniai.com

- `index.html` is the live event page. Everything editable — title, abstract,
  dates, cohorts, speakers, price, and the registration questions — lives in the
  `window.CONFIG` block near the top of the file.
- `success.html` is where Stripe returns people after payment.
- `api/` holds two Vercel serverless functions: `checkout.js` records the
  registration and starts payment, `stripe-webhook.js` marks it paid.
- `apps-script/Code.gs` is the Google Apps Script that collects registrations
  into a sheet. It is not deployed from here; paste it into the sheet.

The page has no build step. Vercel serves the repo root as static files and picks
up `api/` automatically; a push to `main` deploys.

See [SETUP.md](SETUP.md) for wiring up Stripe, the sheet, and the environment
variables the functions need.
