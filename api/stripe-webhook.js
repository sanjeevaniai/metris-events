/* Stripe calls this when a payment finishes, and it flips the sheet row from
   unpaid to paid. Without it the sheet tells you who reached the card screen,
   not who actually paid.

   In the Stripe dashboard: Developers > Webhooks > Add endpoint
     URL:   https://events.sanjeevaniai.com/api/stripe-webhook
     Event: checkout.session.completed
   Then put the signing secret in STRIPE_WEBHOOK_SECRET. */

const Stripe = require("stripe");
const { postToSheet } = require("./_sheet.js");

/* Stripe signs the raw bytes, so the body must not be parsed before we see it */
module.exports.config = { api: { bodyParser: false } };

function rawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", c => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end("Method not allowed. Use POST.");
  }
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(500).end("STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET is not set.");
  }

  const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
  let event;
  try {
    const buf = await rawBody(req);
    event = stripe.webhooks.constructEvent(buf, req.headers["stripe-signature"], process.env.STRIPE_WEBHOOK_SECRET);
  } catch (e) {
    /* 400 tells Stripe not to retry something that will never verify */
    return res.status(400).end("Signature check failed: " + (e && e.message));
  }

  if (event.type === "checkout.session.completed") {
    const s = event.data.object;
    const written = await postToSheet({
      action: "paid",
      id: s.client_reference_id || (s.metadata && s.metadata.registrationId) || "",
      email: (s.customer_details && s.customer_details.email) || s.customer_email || "",
      paid: "yes",
      paidAt: new Date().toISOString(),
      amount: ((s.amount_total || 0) / 100).toFixed(2),
      currency: (s.currency || "usd").toUpperCase(),
      stripe_session_id: s.id,
      paymentIntent: typeof s.payment_intent === "string" ? s.payment_intent : ""
    });

    if (!written.ok) {
      /* 500 makes Stripe retry, which is what we want: the money is taken and
         the sheet does not know it yet */
      console.error("could not mark paid:", s.id, written.error);
      return res.status(500).end("Could not record the payment: " + written.error);
    }
  }

  return res.status(200).json({ received: true });
};
