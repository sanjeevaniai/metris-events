/* Registration capture. Takes the form post, checks it, and forwards it to the
   Apps Script bound to the Google Sheet.

   Environment:
     SHEET_WEBHOOK_URL   the /exec URL of the Apps Script web app

   The redirect handling below is the important part. An Apps Script web app
   answers a POST with a 302 pointing at script.googleusercontent.com. Node's
   fetch follows redirects by default and, per the fetch spec, turns a 302 POST
   into a GET, so the body is dropped on the way. Worse, the GET usually returns
   200, so the call looks like it worked. We use redirect:"manual" instead: the
   original POST has already run doPost by the time the 302 is issued, so a 3xx
   is the success case. A 200 is only trusted after looking at what came back,
   because a deployment that is not open to anyone answers 200 with a Google
   sign-in page. */

const REDIRECTS = [301, 302, 303, 307, 308];
const TIMEOUT_MS = 10000;

function readBody(req) {
  if (typeof req.body === "string") {
    try { return { body: JSON.parse(req.body || "{}") }; }
    catch (e) { return { error: "Request body was not valid JSON." }; }
  }
  if (req.body && typeof req.body === "object") return { body: req.body };
  return { body: {} };
}

async function postJson(url, payload) {
  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      redirect: "manual",
      signal: stop.signal
    });
  } finally {
    clearTimeout(timer);
  }
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

  const url = process.env.SHEET_WEBHOOK_URL;
  if (!url) {
    return res.status(500).json({
      ok: false,
      error: "SHEET_WEBHOOK_URL is not set on the server, so there is nowhere to record this."
    });
  }

  /* the collector checks this before it writes, so the /exec URL being public
     does not mean anyone can put rows in the sheet */
  const outgoing = Object.assign({}, data, { name, email });
  if (process.env.SHEET_SHARED_SECRET) outgoing.secret = process.env.SHEET_SHARED_SECRET;
  const payload = JSON.stringify(outgoing);

  let upstream;
  try {
    upstream = await postJson(url, payload);
  } catch (e) {
    const why = e && e.name === "AbortError"
      ? "The sheet did not answer within " + (TIMEOUT_MS / 1000) + " seconds."
      : "Could not reach the sheet: " + (e && e.message ? e.message : String(e));
    return res.status(502).json({ ok: false, error: why });
  }

  /* doPost has already run; the redirect only carries the response body */
  if (REDIRECTS.includes(upstream.status)) {
    return res.status(200).json({ ok: true });
  }

  let text = "";
  try { text = await upstream.text(); } catch (e) { text = ""; }

  if (upstream.status === 200) {
    const looksLikeHtml = /^\s*</.test(text) || /<!DOCTYPE/i.test(text);
    if (looksLikeHtml) {
      return res.status(502).json({
        ok: false,
        error: "The sheet returned a web page instead of a result, which usually means the "
             + "Apps Script deployment is not set to 'Anyone'. Nothing was recorded."
      });
    }
    try {
      const body = JSON.parse(text);
      if (body && body.ok === false) {
        return res.status(502).json({
          ok: false,
          error: "The sheet rejected the registration: " + (body.error || "no reason given") + "."
        });
      }
    } catch (e) { /* not JSON, but not a login page either; accept it */ }
    return res.status(200).json({ ok: true });
  }

  return res.status(502).json({
    ok: false,
    error: "The sheet answered " + upstream.status + " " + (upstream.statusText || "")
         + (text ? ": " + text.slice(0, 300) : "") + ". Nothing was recorded."
  });
};
