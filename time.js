/* Turning one stored Central wall-clock time into the four zones we show.

   Sessions store a date and a Central time and nothing else. Everything below
   is computed, so nobody has to remember that the autumn sessions are CDT and
   the January ones are CST, and nobody can get it wrong by hardcoding it.

   Loads in a browser (window.METRIS_TIME) and under require() in the functions. */

(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.METRIS_TIME = factory();
})(typeof self !== "undefined" ? self : this, function () {

  /* How far the zone is from UTC at that instant, in milliseconds. */
  function offsetAt(instant, tz) {
    var f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hour12: false,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit"
    });
    var p = {};
    f.formatToParts(instant).forEach(function (x) { p[x.type] = x.value; });
    var asIfUtc = Date.UTC(+p.year, +p.month - 1, +p.day,
                           (+p.hour) % 24, +p.minute, +p.second);
    return asIfUtc - instant.getTime();
  }

  /* "2026-09-30" + "11:00" in Central -> the real instant.
     Solved by iteration because the offset depends on the instant we are
     looking for: guess, measure the zone's offset there, correct, repeat. Two
     passes settle it everywhere except inside the one ambiguous hour when
     clocks go back, which no session here falls in. */
  function toInstant(date, time, tz) {
    var d = String(date).split("-");
    var t = String(time).split(":");
    var wall = Date.UTC(+d[0], +d[1] - 1, +d[2], +t[0], +t[1] || 0, 0);
    var guess = new Date(wall);
    for (var i = 0; i < 3; i++) guess = new Date(wall - offsetAt(guess, tz));
    return guess;
  }

  function partsIn(instant, tz) {
    var f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hour: "numeric", minute: "2-digit",
      hour12: true, timeZoneName: "short"
    });
    var p = {};
    f.formatToParts(instant).forEach(function (x) { p[x.type] = x.value; });
    return {
      time: (p.hour + ":" + p.minute + " " + (p.dayPeriod || "")).trim(),
      abbr: p.timeZoneName || ""
    };
  }

  /* "Wednesday, September 30, 2026" in the session's own zone, so a session
     near midnight cannot be labelled with the reader's date instead. */
  function longDate(instant, tz) {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: tz, weekday: "long", month: "long",
      day: "numeric", year: "numeric"
    }).format(instant);
  }

  function duration(minutes) {
    if (!minutes && minutes !== 0) return null;
    if (minutes < 60) return minutes + " minutes";
    var h = Math.floor(minutes / 60), m = minutes % 60;
    var out = h + (h === 1 ? " hour" : " hours");
    return m ? out + " " + m + " minutes" : out;
  }

  /* Everything a page needs to render one session. Anything undecided stays
     null so the page can say so rather than printing a blank. */
  function describe(session, opts) {
    opts = opts || {};
    var tz = opts.timezone || "America/Chicago";
    var zones = opts.zones || [{ tz: tz, label: "Central" }];
    if (!session || !session.date || !session.startCentral) {
      return { known: false, date: null, times: [], duration: duration(session && session.minutes) };
    }
    var at = toInstant(session.date, session.startCentral, tz);
    return {
      known: true,
      instant: at,
      iso: at.toISOString(),
      date: longDate(at, tz),
      duration: duration(session.minutes),
      times: zones.map(function (z) {
        var p = partsIn(at, z.tz);
        return { label: z.label, time: p.time, abbr: p.abbr };
      })
    };
  }

  return {
    offsetAt: offsetAt,
    toInstant: toInstant,
    partsIn: partsIn,
    longDate: longDate,
    duration: duration,
    describe: describe
  };
});
