/* Stripe calls this when a payment finishes. It flips the sheet row from
   pending to paid, so the sheet tells you who actually paid rather than who
   merely reached the card screen.

   In the Stripe dashboard add an endpoint pointing at
     https://events.sanjeevaniai.com/api/stripe-webhook
   subscribed to checkout.session.completed, then put its signing secret in
   STRIPE_WEBHOOK_SECRET. */

import Stripe from "stripe";

/* Stripe signs the raw bytes, so the body must not be parsed before we see it. */
export const config = { api: { bodyParser: false } };

function rawBody(req){
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", c => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function toSheet(row){
  if(!process.env.SHEET_WEBHOOK_URL) return false;
  try{
    const res = await fetch(process.env.SHEET_WEBHOOK_URL, {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({ secret: process.env.SHEET_SHARED_SECRET, ...row })
    });
    return res.ok;
  }catch(e){ return false; }
}

export default async function handler(req, res){
  if(req.method !== "POST"){
    res.setHeader("Allow","POST");
    return res.status(405).end("method not allowed");
  }

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  let event;
  try{
    const buf = await rawBody(req);
    event = stripe.webhooks.constructEvent(buf, req.headers["stripe-signature"], secret);
  }catch(e){
    return res.status(400).end("signature check failed: " + (e && e.message));
  }

  if(event.type === "checkout.session.completed"){
    const s = event.data.object;
    await toSheet({
      action: "paid",
      id: s.client_reference_id || (s.metadata && s.metadata.registrationId) || "",
      stamp: new Date().toISOString(),
      status: "paid",
      email: s.customer_details && s.customer_details.email,
      amount: ((s.amount_total || 0) / 100).toFixed(2),
      currency: (s.currency || "usd").toUpperCase(),
      paymentIntent: s.payment_intent || "",
      sessionId: s.id
    });
  }

  /* always 200, or Stripe keeps retrying */
  return res.status(200).json({ received:true });
}
