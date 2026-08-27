/* Records a registration, then sends the registrant to Stripe to pay.

   The sheet row is written BEFORE payment and marked unpaid, so that someone who
   reaches the card screen and leaves is still visible to you. api/stripe-webhook
   flips the row to paid once Stripe confirms the charge.

   Environment:
     STRIPE_SECRET_KEY    sk_live_... or sk_test_...
     SHEET_WEBHOOK_URL    the /exec URL of the Apps Script
     SHEET_SHARED_SECRET  must match SHARED_SECRET in Code.gs
     PRICE_CENTS          optional, defaults to 19900
     STRIPE_PRICE_ID      optional, a Stripe Price to use instead of PRICE_CENTS
     SITE_URL             optional, overrides the host used in the return links */

const Stripe = require("stripe");
const { postToSheet } = require("./_sheet.js");

/* Stripe caps metadata at 50 keys and 500 characters per value */
function trim(v) {
  const s = String(v == null ? "" : v);
  return s.length > 480 ? s.slice(0, 477) + "..." : s;
}

function newId() {
  return "reg_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
}

function readBody(req) {
  if (typeof req.body === "string") {
    try { return { body: JSON.parse(req.body || "{}") }; }
    catch (e) { return { error: "Request body was not valid JSON." }; }
  }
  if (req.body && typeof req.body === "object") return { body: req.body };
  return { body: {} };
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed. Use POST." });
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(500).json({ ok: false, error: "STRIPE_SECRET_KEY is not set on the server, so payment cannot be taken." });
  }

  const parsed = readBody(req);
  if (parsed.error) return res.status(400).json({ ok: false, error: parsed.error });

  const d = parsed.body;
  const data = {};
  ["name","email","company","role","headcount","industry","campaign",
   "answer1","answer2","answer3","jobTitle","country","sizeBand","openAsk"]
    .forEach(k => { data[k] = trim(d[k]).trim(); });

  if (!data.name)  return res.status(400).json({ ok: false, error: "Name is required." });
  if (!data.email) return res.status(400).json({ ok: false, error: "Email is required." });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.email)) {
    return res.status(400).json({ ok: false, error: "That email address does not look complete." });
  }

  const id = newId();

  /* written first, so an abandoned checkout still leaves a trace */
  const sheet = await postToSheet(Object.assign({ id: id, paid: "no" }, data));
  if (!sheet.ok) {
    /* refuse to charge someone whose registration was not recorded */
    return res.status(502).json({ ok: false, error: sheet.error });
  }

  const site = process.env.SITE_URL ||
    ("https://" + (req.headers["x-forwarded-host"] || req.headers.host));

  try {
    const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
    const lineItem = process.env.STRIPE_PRICE_ID
      ? { price: process.env.STRIPE_PRICE_ID, quantity: 1 }
      : { quantity: 1, price_data: {
            currency: "usd",
            unit_amount: parseInt(process.env.PRICE_CENTS || "19900", 10),
            product_data: {
              name: "METRIS workshop seat",
              description: "AI is already in your organization. What do you actually know about it?"
            }
          } };

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [ lineItem ],
      customer_email: data.email,
      client_reference_id: id,
      success_url: site + "/success.html?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: site + "/?cancelled=1#register",
      metadata: Object.assign({ registrationId: id }, data)
    });

    return res.status(200).json({ ok: true, url: session.url, id: id });
  } catch (e) {
    /* the registration is recorded; only the payment leg failed */
    return res.status(502).json({
      ok: false,
      recorded: true,
      error: "Your details were saved, but Stripe could not start the payment: "
           + (e && e.message ? e.message : String(e))
    });
  }
};
