/* Talking to our own endpoints without ever leaving a button stuck.

   Every failure here is a registration that did not happen, so the rules are:
   the call always settles, the button is always released, and whatever actually
   went wrong is what the visitor is shown. A fetch with no timeout will hang for
   as long as the network does, which is what left the button reading
   "One moment" with nothing behind it. */

(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.METRIS_NET = factory();
})(typeof self !== "undefined" ? self : this, function () {

  /* The id is minted here rather than waiting for the server to hand one back,
     so nothing downstream depends on that round trip finishing. */
  function newId() {
    return "reg_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
  }

  /* Never throws. Always resolves, and always within timeoutMs. */
  async function postJson(url, body, opts) {
    opts = opts || {};
    var timeoutMs = opts.timeoutMs || 15000;
    var stop = new AbortController();
    var timer = setTimeout(function(){ stop.abort(); }, timeoutMs);

    try {
      var res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: stop.signal,
        keepalive: !!opts.keepalive
      });
      var parsed = null;
      try { parsed = await res.json(); } catch (e) { /* not JSON */ }

      if (!res.ok || !parsed || parsed.ok !== true) {
        return {
          ok: false,
          status: res.status,
          body: parsed,
          error: (parsed && parsed.error) ||
                 ("The server answered " + res.status + " " + (res.statusText || "") + ".")
        };
      }
      return { ok: true, status: res.status, body: parsed };
    } catch (e) {
      var aborted = e && e.name === "AbortError";
      return {
        ok: false,
        status: 0,
        timedOut: aborted,
        error: aborted
          ? "That took longer than " + Math.round(timeoutMs / 1000) +
            " seconds and was stopped, so nothing was recorded."
          : "Could not reach the server: " + ((e && e.message) || String(e)) + "."
      };
    } finally {
      clearTimeout(timer);
    }
  }

  /* Resolves with the request's result, or with null once ms have passed,
     whichever comes first. The request is NOT cancelled: paired with
     keepalive it finishes in the background even after the page has gone. */
  function raceTimeout(promise, ms) {
    return Promise.race([
      promise,
      new Promise(function (r) { setTimeout(function(){ r(null); }, ms); })
    ]);
  }

  /* Says which build is running. A page loaded before a change keeps the old
     JavaScript in memory however good the cache headers are, and the only way to
     tell from the outside used to be a screenshot. If this line is missing from
     the console, the tab is stale and a reload is the fix. */
  try { console.info("METRIS build: submit paths are timeout-bounded (net.js loaded)"); } catch (e) {}

  return { newId: newId, postJson: postJson, raceTimeout: raceTimeout };
});
