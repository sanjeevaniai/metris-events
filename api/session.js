/* Looks a Checkout session up with Stripe so the confirmation page can prove a
   payment happened before it confirms anything.

   The session id arrives in the URL, which anyone can edit, so the page is not
   allowed to believe it. It asks here, this asks Stripe, and only a
   payment_status of "paid" comes back as paid: true. A cancelled, unpaid, or
   invented session id gets paid: false and the page shows nothing confirming.

   Environment:
     STRIPE_SECRET_KEY   sk_test_... while testing, sk_live_... when live */

const Stripe = require("stripe");
const M = require("../sessions.js");

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed. Use GET." });
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(500).json({ ok: false, error: "STRIPE_SECRET_KEY is not set on the server." });
  }

  const url = new URL(req.url, "http://localhost");
  const id = (url.searchParams.get("session_id") || "").trim();

  if (!id || !/^cs_[A-Za-z0-9_]+$/.test(id)) {
    return res.status(400).json({ ok: false, paid: false, error: "No usable session id." });
  }

  try {
    const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
    const s = await stripe.checkout.sessions.retrieve(id);
    const paid = s.payment_status === "paid";

    /* Which track was bought, so the confirmation page can list its three
       sessions. Derived from the seat in metadata, because seat is the source
       of truth; the group in metadata is only a cross-check. */
    var groupSlug = "";
    if (paid && s.metadata) {
      var g = s.metadata.seat ? M.groupForSeat(s.metadata.seat) : null;
      if (!g && s.metadata.group) g = M.group(s.metadata.group);
      if (g) groupSlug = g.slug;
    }

    /* only what the page needs to render, never the whole session */
    return res.status(200).json({
      ok: true,
      paid: paid,
      status: s.status || "",
      paymentStatus: s.payment_status || "",
      email: paid ? ((s.customer_details && s.customer_details.email) || s.customer_email || "") : "",
      amount: paid ? ((s.amount_total || 0) / 100).toFixed(2) : "",
      currency: paid ? (s.currency || "usd").toUpperCase() : "",
      group: groupSlug,
      seat: paid && s.metadata ? (s.metadata.seat || "") : ""
    });
  } catch (e) {
    /* an id Stripe does not know is a client mistake, not a server fault */
    const missing = e && (e.statusCode === 404 || e.code === "resource_missing");
    return res.status(missing ? 404 : 502).json({
      ok: false,
      paid: false,
      error: missing ? "Stripe does not recognise that session."
                     : "Could not reach Stripe: " + (e && e.message ? e.message : String(e))
    });
  }
};
