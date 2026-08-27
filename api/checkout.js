/* Creates a Stripe Checkout session for a registration that has ALREADY been
   written to the sheet.

   Order matters and is deliberate: the page posts to /api/register first, so the
   lead is recorded with paid = no, and only calls this once that write has come
   back ok. Someone who abandons the card screen is therefore still in the sheet.
   This endpoint does not touch the sheet at all.

   Environment:
     STRIPE_SECRET_KEY   sk_test_... while testing, sk_live_... when live
     STRIPE_PRICE_ID     price_... the $199 price, created in the Stripe dashboard
     PUBLIC_SITE_URL     optional, the site address used in the return links
                         (SITE_URL is accepted too) */

const Stripe = require("stripe");

/* Stripe rejects metadata with more than 50 keys or values over 500 characters */
const META_KEYS = ["id","name","email","jobTitle","company","country","role",
                   "headcount","sizeBand","industry","campaign",
                   "answer1","answer2","answer3","openAsk"];

function trim(v) {
  const s = String(v == null ? "" : v).trim();
  return s.length > 480 ? s.slice(0, 477) + "..." : s;
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
  if (!process.env.STRIPE_PRICE_ID) {
    return res.status(500).json({ ok: false, error: "STRIPE_PRICE_ID is not set on the server, so there is no price to charge." });
  }

  const parsed = readBody(req);
  if (parsed.error) return res.status(400).json({ ok: false, error: parsed.error });

  const d = parsed.body;
  const email = trim(d.email);
  if (!email) return res.status(400).json({ ok: false, error: "Email is required." });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return res.status(400).json({ ok: false, error: "That email address does not look complete." });
  }

  const metadata = {};
  META_KEYS.forEach(k => { const v = trim(d[k]); if (v) metadata[k] = v; });

  const site = process.env.PUBLIC_SITE_URL || process.env.SITE_URL ||
    ("https://" + (req.headers["x-forwarded-host"] || req.headers.host));

  try {
    const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [ { price: process.env.STRIPE_PRICE_ID, quantity: 1 } ],
      customer_email: email,
      client_reference_id: trim(d.id) || undefined,
      metadata: metadata,
      success_url: site + "/success.html?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: site + "/?cancelled=1#register"
    });
    return res.status(200).json({ ok: true, url: session.url, id: session.id });
  } catch (e) {
    /* the registration is already in the sheet, so only the payment leg failed */
    return res.status(502).json({
      ok: false,
      error: "Stripe could not start the payment: " + (e && e.message ? e.message : String(e))
    });
  }
};
