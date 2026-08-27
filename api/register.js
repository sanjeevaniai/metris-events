/* Registration capture without payment. Kept for the case where a seat is
   comped or booked by hand; the public form goes through api/checkout.js so the
   seat is paid for. Both write the same shape of row. */

const { postToSheet } = require("./_sheet.js");

/* the id is minted here, not by the Apps Script: its reply is behind a 302 that
   we deliberately do not follow, so we would never see an id it generated */
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

  const parsed = readBody(req);
  if (parsed.error) return res.status(400).json({ ok: false, error: parsed.error });

  const data = parsed.body;
  const name  = String(data.name  == null ? "" : data.name).trim();
  const email = String(data.email == null ? "" : data.email).trim();

  if (!name)  return res.status(400).json({ ok: false, error: "Name is required." });
  if (!email) return res.status(400).json({ ok: false, error: "Email is required." });

  const id = String(data.id || "").trim() || newId();

  const written = await postToSheet(Object.assign({}, data, {
    id: id, name: name, email: email, paid: "no"
  }));
  if (!written.ok) return res.status(502).json({ ok: false, error: written.error });

  /* the id goes back so the payment step can carry it as client_reference_id */
  return res.status(200).json({ ok: true, id: id });
};
