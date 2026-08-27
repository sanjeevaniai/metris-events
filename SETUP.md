# Setting up payment and registration capture

The page is still static. Two serverless functions sit beside it in `api/`, and
Vercel picks them up automatically — there is no build step for the page itself.

What happens when someone registers:

1. The page posts the registration to `/api/register`, which writes the row to
   the Google Sheet with **paid = no**.
2. Only once that write has come back ok does the page ask `/api/checkout` for a
   Stripe Checkout session and hand the registrant over. The order is deliberate:
   an abandoned payment still leaves the lead in the sheet.
3. Stripe takes the $199 and returns them to `/success.html?session_id=...`.
4. That page shows nothing until `/api/session` has asked Stripe, server side,
   whether the session was actually paid. A cancelled, unpaid or invented session
   id gets a page saying the seat is **not** booked.

There is no webhook, which means **nothing ever changes the paid column**. See
"What the missing webhook costs you" at the end.

---

## 1. The Google Sheet

1. Make a new Google Sheet, name it something like `METRIS registrations`.
2. **Extensions → Apps Script**, delete what is there, paste in
   `apps-script/Code.gs` from this repo.
3. Change `SHARED_SECRET` at the top to a long random string. Keep it handy.
4. **Deploy → New deployment → Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Copy the `/exec` URL it gives you.

Opening that URL in a browser should say the collector is running. If it says
**"Script function not found: doGet"**, the deployment is live but is pinned to a
version of the script that predates the code — see below.

**Editing the script does not change an existing deployment.** Apps Script pins
each deployment to a version, so after any edit you have to publish a new one:
**Deploy → Manage deployments → the pencil icon → Version: New version → Deploy**.
Doing it that way keeps the same `/exec` URL. Creating a brand new deployment
instead gives you a different URL, which then has to go back into the env vars.

The sheet and its `Registrations` tab are created on the first registration, so
do not worry that the sheet looks empty.

## 2. Stripe

1. Copy your secret key from the Stripe dashboard: `sk_test_...` while you are
   testing, `sk_live_...` when you go live.
2. **Developers > Webhooks > Add endpoint**
   - URL: `https://events.sanjeevaniai.com/api/stripe-webhook`
   - Event: `checkout.session.completed`
3. Copy that endpoint's **signing secret** (`whsec_...`).

The price lives in code, so there is no product to create in Stripe. If you would
rather manage it there, make a Price and set `STRIPE_PRICE_ID` instead.

The webhook is what turns the **paid** column from no to yes. Without it the sheet
records who reached the card screen, not who paid.

## 3. Vercel environment variables

**Project → Settings → Environment Variables**, for Production and Preview:

| Name | Value |
|---|---|
| `STRIPE_SECRET_KEY` | `sk_live_…` from step 2 |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` from step 2 |
| `SHEET_WEBHOOK_URL` | the `/exec` URL from step 1 |
| `SHEET_SHARED_SECRET` | the same random string you put in `Code.gs` |

Optional:

| Name | Value |
|---|---|
| `PRICE_CENTS` | defaults to `19900`. Set it to change the price. |
| `STRIPE_PRICE_ID` | `price_…` to use a Stripe Price instead of `PRICE_CENTS` |
| `SITE_URL` | overrides the site address used in the return links |

Redeploy after adding them — Vercel only picks up new variables on a fresh build.

## 4. Running it locally

```
npx vercel dev
```

Put the variables in **`.env`**, not `.env.local`. `vercel dev` does not read
`.env.local` — that file is only where `vercel env pull` writes what it fetches
from the Vercel project. Both files are gitignored.

```
SHEET_WEBHOOK_URL="https://script.google.com/macros/s/YOUR_ID/exec"
```

`vercel dev` reads the file once at startup, so restart it after any change.
Exporting the variable in the shell that launches it works too:

```
SHEET_WEBHOOK_URL="https://script.google.com/macros/s/YOUR_ID/exec" npx vercel dev
```

Check the endpoint without touching the form:

```
curl -X POST http://localhost:3000/api/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"Test","email":"t@example.com"}'
```

`{"ok":true}` means the row landed. Anything else says what went wrong: a 404
means the Apps Script deployment does not exist at that URL, and an HTML page
means it is not shared with Anyone.

## 5. Test before going live

Use the test key and Stripe's test card `4242 4242 4242 4242`, any future expiry,
any CVC. Register once and check that:

- a row appears in the sheet as **pending**
- it flips to **paid** within a few seconds of payment
- you land on `/success.html` with a reference number

Then swap the test keys for live ones and redeploy.

## What the missing webhook costs you

Without a webhook, **the paid column stays `no` on every row, forever** — including
rows where the money arrived. Nothing writes back to the sheet after checkout.

So the sheet answers "who filled in the form", not "who paid". To know who paid,
read the Stripe dashboard, and reconcile by email or by the `client_reference_id`
on each payment, which is the registration id.

The confirmation page is not a substitute. It verifies payment properly for the
person looking at it, but it verifies nothing for you, and it never writes
anything down.

Two ways to close the gap when you want it:

- **Add the webhook back.** It is in git history: `git show 53d1760:api/stripe-webhook.js`.
  It listens for `checkout.session.completed` and flips the row to paid. This is
  the reliable option, because Stripe retries until it succeeds.
- **Have `/api/session` mark the row** when it sees a paid session. Roughly ten
  lines. Cheaper, but it only fires if the registrant actually lands back on the
  confirmation page, so anyone who pays and closes the tab stays `no`.

## Still to do

- The Zoom link is not on the page or in any email. The confirmation page says
  the joining link follows by email, so nothing is broken while it is missing,
  but somebody has to send that email.
- Nothing emails the registrant beyond Stripe's own receipt.
