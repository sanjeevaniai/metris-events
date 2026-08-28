# Setting up payment and registration capture

The page is still static. Two serverless functions sit beside it in `api/`, and
Vercel picks them up automatically — there is no build step for the page itself.

What happens when someone registers:

1. **Page one** (`/`) asks for the seat, the industry and the company size, and
   posts a row to `/api/register` marked **stage = filter**. Somebody who filters
   and leaves is a lead, not a nothing. It then routes to the group page for that
   seat, carrying the row's id in the URL.
2. **The group page** (`/group-a`, `/group-b`, `/group-c`) asks the three
   questions and the contact fields, and posts to `/api/register` again with the
   same id and **stage = registration**. Same id means the same person, so the
   filter row is filled in rather than duplicated.
3. Only once that write has come back ok does the page ask `/api/checkout` for a
   Stripe session and hand the registrant over. **Do not reverse that order** -
   an abandoned payment must still leave the lead in the sheet.
4. Stripe returns them to `/success?session_id=...`, which shows nothing until
   `/api/session` has asked Stripe, server side, whether the session was paid.
   The confirmation lists all three sessions of the track that was bought.
5. **The catch-all** (`/other`) takes seat and contact details only, no payment,
   for anyone whose seat is not part of a track.

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

Create one Price per track, each $249 one-time, and paste its id into that
group's `stripePriceId` in `sessions.js`. This is the one thing adding a group
cannot do from the data file alone.

**The three price ids in `sessions.js` today are test-mode objects.** They work
in the sandbox and will not resolve against a live key: with `sk_live_` set,
every group refuses by name and no payment is taken. Replace them with live ids
before launch. Nothing in this repo creates Stripe objects, by standing rule.

The webhook is what turns the **paid** column from no to yes. Without it the sheet
records who reached the card screen, not who paid.

## 3. Vercel environment variables

**Project → Settings → Environment Variables**, for Production and Preview:

| Name | Value |
|---|---|
| `STRIPE_SECRET_KEY` | `sk_live_...` from step 2 |
| `SHEET_WEBHOOK_URL` | the `/exec` URL from step 1 |
| `SHEET_SHARED_SECRET` | the same random string you put in `Code.gs` |
| `PUBLIC_SITE_URL` | `https://events.sanjeevaniai.com` |

There is deliberately no `STRIPE_PRICE_ID` and no `PRICE_CENTS`. The price for
each track lives in `sessions.js` as that group's `stripePriceId`, and there is
no environment fallback: a group whose price is missing or whose amount is not
$249 is refused by name rather than charged the wrong amount.

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
