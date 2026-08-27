/* Takes a registration, records it in the Google Sheet as pending, then hands
   the registrant to Stripe Checkout. The sheet row is written BEFORE payment so
   that people who drop out at the card screen are still visible to you.

   Environment variables, all set in the Vercel project:
     STRIPE_SECRET_KEY    sk_live_... or sk_test_...
     SHEET_WEBHOOK_URL    the /exec URL of the Apps Script bound to the sheet
     SHEET_SHARED_SECRET  any long random string, must match the Apps Script
     STRIPE_PRICE_ID      optional, use a real Stripe Price instead of the amount below
     PRICE_CENTS          optional, defaults to 19900
     SITE_URL             optional, defaults to the host the request arrived on */

import Stripe from "stripe";

const FIELDS = ["firstName","lastName","email","jobTitle","company","country",
                "role","headcount","sizeBand","industry","q1","q2","q3",
                "openAsk","campaign"];

function registrationId(){
  return "reg_" + Date.now().toString(36) + "_" +
         Math.random().toString(36).slice(2,8);
}

/* Stripe rejects metadata values over 500 characters and more than 50 keys. */
function trim(v){
  const s = String(v == null ? "" : v);
  return s.length > 480 ? s.slice(0,477) + "..." : s;
}

async function toSheet(row){
  if(!process.env.SHEET_WEBHOOK_URL) return { ok:false, skipped:true };
  try{
    const res = await fetch(process.env.SHEET_WEBHOOK_URL, {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({ secret: process.env.SHEET_SHARED_SECRET, ...row })
    });
    return { ok: res.ok, status: res.status };
  }catch(e){
    return { ok:false, error: String(e) };
  }
}

export default async function handler(req, res){
  if(req.method !== "POST"){
    res.setHeader("Allow","POST");
    return res.status(405).json({ error:"method not allowed" });
  }
  if(!process.env.STRIPE_SECRET_KEY){
    return res.status(500).json({ error:"STRIPE_SECRET_KEY is not set" });
  }

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  const data = {};
  FIELDS.forEach(k => { data[k] = trim(body[k]).trim(); });

  /* the same checks the page makes, repeated here because the page can be bypassed */
  const required = ["firstName","lastName","email","jobTitle","company","country",
                    "role","sizeBand","industry","q1","q2","q3"];
  const missing = required.filter(k => !data[k]);
  if(missing.length) return res.status(400).json({ error:"missing fields", missing });
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.email)){
    return res.status(400).json({ error:"invalid email" });
  }

  const id = registrationId();
  const stamp = new Date().toISOString();

  /* written first, so an abandoned checkout still leaves a trace */
  const sheet = await toSheet({ action:"register", id, stamp, status:"pending", ...data });

  const site = process.env.SITE_URL ||
    ("https://" + (req.headers["x-forwarded-host"] || req.headers.host));

  try{
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
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
      metadata: { registrationId: id, ...data }
    });

    return res.status(200).json({ url: session.url, id, sheet: sheet.ok });
  }catch(e){
    /* the registration is already in the sheet, so say so rather than losing it */
    return res.status(502).json({ error:"stripe", detail: e && e.message, id, recorded: sheet.ok });
  }
}
