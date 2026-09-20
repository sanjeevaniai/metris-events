/* Creates a Stripe Checkout session for a registration ALREADY written to the
   sheet by /api/register. This endpoint does not touch the sheet.

   The price comes from the group's own stripePriceId in sessions.js. There is
   deliberately NO environment-variable fallback. A backstop price belongs to
   whichever group last used it, so falling back to one would charge somebody the
   wrong amount silently. A group with a missing, archived, or wrongly priced
   Stripe price is refused by name instead.

   Group is derived here from the seat that was chosen. The seat is what the
   registrant actually picked, so it is what decides everything.

   Environment:
     STRIPE_SECRET_KEY   sk_test_... while testing, sk_live_... when live
     PUBLIC_SITE_URL     the site address used in the return links
                         (SITE_URL is accepted too) */

const Stripe = require("stripe");
const M = require("../sessions.js");

const META_KEYS = ["id","seat","group","name","email","jobTitle","company","country",
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

  const parsed = readBody(req);
  if (parsed.error) return res.status(400).json({ ok: false, error: parsed.error });

  const d = parsed.body;

  const seatId = trim(d.seat);
  const seat = M.seat(seatId);
  if (!seat) return res.status(400).json({ ok: false, error: "That is not a seat we recognise." });

  const group = M.groupForSeat(seatId);
  if (!group) {
    return res.status(400).json({
      ok: false,
      error: "The seat \"" + seat.label + "\" is not part of a paid track, so there is nothing to charge for."
    });
  }

  /* refuse rather than charge a price that was not meant for this group */
  const priceId = group.stripePriceId;
  if (!priceId || typeof priceId !== "string" || priceId.indexOf("price_") !== 0) {
    return res.status(500).json({
      ok: false,
      error: "Group " + group.letter + " (" + group.slug + ") has no usable Stripe price id, "
           + "so no payment can be taken for it. Set stripePriceId for that group in sessions.js."
    });
  }

  const email = trim(d.email);
  if (!email) return res.status(400).json({ ok: false, error: "Email is required." });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return res.status(400).json({ ok: false, error: "That email address does not look complete." });
  }

  const metadata = { group: group.slug, seat: seatId };
  META_KEYS.forEach(k => { const v = trim(d[k]); if (v) metadata[k] = v; });

  const site = process.env.PUBLIC_SITE_URL || process.env.SITE_URL ||
    ("https://" + (req.headers["x-forwarded-host"] || req.headers.host));

  try {
    const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

    /* fail on a price that does not exist, or is not the currency and amount the
       page advertised, before anyone is sent to a checkout screen */
    const price = await stripe.prices.retrieve(priceId);
    if (!price.active) {
      return res.status(500).json({ ok: false, error: "The Stripe price for group " + group.letter + " is archived." });
    }
    if (price.unit_amount !== M.PRICE.amount * 100 || price.currency !== M.PRICE.currency) {
      return res.status(500).json({
        ok: false,
        error: "The Stripe price for group " + group.letter + " is "
             + (price.unit_amount / 100).toFixed(2) + " " + price.currency.toUpperCase()
             + ", but the page advertises " + M.PRICE.display + ". Refusing to charge a different amount."
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [ { price: priceId, quantity: 1 } ],
      customer_email: email,
      client_reference_id: trim(d.id) || undefined,
      metadata: metadata,
      success_url: site + "/success?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: site + "/" + group.slug + "?cancelled=1#register"
    });
    return res.status(200).json({ ok: true, url: session.url, id: session.id });
  } catch (e) {
    /* the registration is already recorded; only the payment leg failed */
    return res.status(502).json({
      ok: false,
      error: "Stripe could not start the payment: " + (e && e.message ? e.message : String(e))
    });
  }
};
