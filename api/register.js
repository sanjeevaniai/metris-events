/* Writes a row to the sheet. Two kinds of row come through here.

   stage "filter"       page one. Seat, industry and company size, no contact
                        details, because page one does not ask for any. Captured
                        so that somebody who picks a seat and leaves is still a
                        lead. Name and email are NOT required for these.

   stage "registration" a group page or the catch-all. Contact details are
                        required. On a group page this runs BEFORE payment and
                        writes paid = no, so an abandoned checkout still leaves
                        the lead behind. api/checkout.js is only called once this
                        has come back ok. Do not reverse that order.

   The id is minted here and handed back. Page one carries it in the URL to the
   group page, which sends it again, so the two stages join into one row rather
   than two. The Apps Script reply is behind a 302 we deliberately do not follow,
   so an id generated there would never be seen.

   Seat is the source of truth. Group is derived from seat here, written for
   convenience, and never read back to decide anything. */

const { postToSheet } = require("./_sheet.js");
const M = require("../sessions.js");

const STAGES = ["filter", "registration"];

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

const str = v => String(v == null ? "" : v).trim();

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed. Use POST." });
  }

  const parsed = readBody(req);
  if (parsed.error) return res.status(400).json({ ok: false, error: parsed.error });

  const d = parsed.body;
  const stage = STAGES.indexOf(str(d.stage)) > -1 ? str(d.stage) : "registration";

  const seatId = str(d.seat);
  const seat = M.seat(seatId);
  if (!seat) {
    return res.status(400).json({ ok: false, error: "That is not a seat we recognise." });
  }

  /* derived, never authoritative */
  const group = M.groupForSeat(seatId);

  const name  = str(d.name);
  const email = str(d.email);
  if (stage === "registration") {
    if (!name)  return res.status(400).json({ ok: false, error: "Name is required." });
    if (!email) return res.status(400).json({ ok: false, error: "Email is required." });
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return res.status(400).json({ ok: false, error: "That email address does not look complete." });
    }
  }

  const id = str(d.id) || newId();

  const row = {
    id: id,
    stage: stage,
    seat: seatId,
    seatLabel: seat.label,
    group: group ? group.slug : "",
    sessionSlug: str(d.sessionSlug),
    layer: str(d.layer),
    name: name,
    email: email,
    jobTitle: str(d.jobTitle),
    company: str(d.company),
    country: str(d.country),
    role: seat.label,          /* kept so the existing role column stays populated */
    headcount: str(d.headcount),
    sizeBand: str(d.sizeBand),
    industry: str(d.industry),
    campaign: str(d.campaign),
    answer1: str(d.answer1),
    answer2: str(d.answer2),
    answer3: str(d.answer3),
    openAsk: str(d.openAsk),
    paid: "no"
  };

  const written = await postToSheet(row);
  if (!written.ok) return res.status(502).json({ ok: false, error: written.error });

  return res.status(200).json({
    ok: true,
    id: id,
    seat: seatId,
    group: group ? group.slug : null
  });
};
