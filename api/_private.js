/* Server-only values. Never import this from anything the browser loads.

   Files beginning with an underscore are not routed by Vercel, and nothing in
   the repo serves this file as a static asset, so it exists only inside the
   functions. The joining link is here rather than in sessions.js because
   sessions.js is downloaded by every visitor, paid or not. */

/* One recurring Zoom meeting serves all nine sessions, so there is one URL.
   Set ZOOM_JOIN_URL in the environment. Null until it is set, and null is
   rendered as visibly missing rather than as a blank. */
function joinUrl() {
  const v = String(process.env.ZOOM_JOIN_URL || "").trim();
  return v || null;
}

module.exports = { joinUrl };
