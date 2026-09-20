/* Posting to the Apps Script bound to the Google Sheet.

   Files starting with an underscore are not routed by Vercel, so this is shared
   code rather than an endpoint.

   An Apps Script web app answers a POST with a 302. Node's fetch follows a 302
   by turning the POST into a GET, dropping the body, and the GET then returns
   200 whatever happened. So redirects are handled manually: doPost has already
   run by the time the redirect is issued, which makes a 3xx the success case,
   and a 200 is only trusted after looking at what came back. */

const REDIRECTS = [301, 302, 303, 307, 308];
const TIMEOUT_MS = 10000;

async function postToSheet(row) {
  const url = process.env.SHEET_WEBHOOK_URL;
  if (!url) {
    return { ok: false, error: "SHEET_WEBHOOK_URL is not set on the server, so there is nowhere to record this." };
  }

  const body = Object.assign({}, row);
  if (process.env.SHEET_SHARED_SECRET) body.secret = process.env.SHEET_SHARED_SECRET;

  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), TIMEOUT_MS);
  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      redirect: "manual",
      signal: stop.signal
    });
  } catch (e) {
    return {
      ok: false,
      error: e && e.name === "AbortError"
        ? "The sheet did not answer within " + (TIMEOUT_MS / 1000) + " seconds."
        : "Could not reach the sheet: " + (e && e.message ? e.message : String(e))
    };
  } finally {
    clearTimeout(timer);
  }

  if (REDIRECTS.includes(res.status)) return { ok: true };

  let text = "";
  try { text = await res.text(); } catch (e) { text = ""; }

  if (res.status === 200) {
    if (/^\s*</.test(text) || /<!DOCTYPE/i.test(text)) {
      return { ok: false, error: "The sheet returned a web page instead of a result, which usually means the Apps Script deployment is not set to 'Anyone'. Nothing was recorded." };
    }
    try {
      const parsed = JSON.parse(text);
      if (parsed && parsed.ok === false) {
        return { ok: false, error: "The sheet rejected it: " + (parsed.error || "no reason given") + "." };
      }
    } catch (e) { /* not JSON, but not a sign-in page either */ }
    return { ok: true };
  }

  return {
    ok: false,
    error: "The sheet answered " + res.status + " " + (res.statusText || "")
         + (text ? ": " + text.slice(0, 300) : "") + ". Nothing was recorded."
  };
}

module.exports = { postToSheet };
