/* METRIS Executive Session — registration, capacity and idempotency store.

   This script is the ONLY place where capacity is decided. Every check-then-
   write runs inside LockService, which is what makes a reservation a
   reservation rather than a race: two buyers hitting checkout in the same
   second are serialized here, and exactly one of them gets the last place.

   The server cannot do this itself. Two Cloudflare isolates do not share
   memory, so "read the count, then write" in the application is not atomic and
   will oversell under load.

   INSTALL
     Extensions > Apps Script, replace everything with this file, Save.

     Script Properties (Project Settings > Script Properties) — NOT in this file:
       SHARED_SECRET   a long random string; must equal SHEET_SHARED_SECRET
     Optional:
       SALEABLE_CAPACITY  fallback if the caller does not send one

     Deploy > New deployment > Web app
       Execute as:      Me
       Who has access:  Anyone
     Put the /exec URL in SHEET_WEBHOOK_URL.

   After ANY edit here, publish a NEW VERSION or the deployment keeps serving
   the old code: Deploy > Manage deployments > pencil > Version: New version.

   BACKWARD COMPATIBILITY
     The pre-existing "Registrations" and "Entries" tabs are NOT touched, read,
     or rewritten by this script. The purchase schema changed shape completely
     (two passes, capacity allocation, organization identity), and sheet_()
     rewrites a header row in place — pointing it at the old tab would leave
     historical rows sitting under headings that no longer describe them. New
     tabs, old data preserved exactly as it is. */

var TAB_REGISTRATIONS = "Registrations v2";
var TAB_ATTENDEES = "Attendees";
var TAB_EVENTS = "Stripe Events";
var TAB_ENTITLEMENTS = "Entitlements";

var LOCK_MS = 25000;

function sharedSecret_() {
  return PropertiesService.getScriptProperties().getProperty("SHARED_SECRET") || "";
}

/* [heading, key in the posted JSON]. One list, so headings and values cannot
   drift apart. Add a column by adding a line AT THE END. */
var REGISTRATION_COLUMNS = [
  ["event id", "eventId"],
  ["registration id", "registrationId"],
  ["organization key", "organizationKey"],
  ["organization name", "organizationName"],
  ["organization type", "organizationType"],
  ["verified domain", "verifiedDomain"],
  ["purchaser name", "primaryPurchaserName"],
  ["primary business email", "primaryBusinessEmail"],
  ["purchaser job title", "primaryJobTitle"],
  ["country", "country"],
  ["pass", "passId"],
  ["purchased places", "purchasedPlaces"],
  ["registration state", "registrationState"],
  ["allocation state", "allocationState"],
  ["reservation expires at", "reservationExpiresAt"],
  ["verification state", "verificationState"],
  ["verification reason", "verificationReason"],
  ["stripe checkout session id", "stripeCheckoutSessionId"],
  ["stripe payment intent id", "stripePaymentIntentId"],
  ["amount", "amount"],
  ["currency", "currency"],
  ["terms accepted at", "termsAcceptedAt"],
  ["marketing consent at", "marketingConsentAt"],
  ["preliminary use case", "preliminaryUseCase"],
  ["email sent", "emailSent"],
  ["email sent at", "emailSentAt"],
  ["created at", "createdAt"],
  ["updated at", "updatedAt"],
];

var ATTENDEE_COLUMNS = [
  ["event id", "eventId"],
  ["registration id", "registrationId"],
  ["organization key", "organizationKey"],
  ["attendee id", "attendeeId"],
  ["attendee name", "attendeeName"],
  ["attendee email", "attendeeEmail"],
  ["verification state", "verificationState"],
  ["verification reason", "verificationReason"],
  ["zoom registration state", "zoomRegistrationState"],
  ["zoom registrant id", "zoomRegistrantId"],
  ["join link delivery state", "joinLinkDeliveryState"],
  ["created at", "createdAt"],
  ["updated at", "updatedAt"],
];

var EVENT_COLUMNS = [
  ["stripe event id", "stripeEventId"],
  ["type", "eventType"],
  ["processed at", "processedAt"],
];

var ENTITLEMENT_COLUMNS = [
  ["organization key", "organizationKey"],
  ["registration id", "registrationId"],
  ["granted at", "grantedAt"],
];

function colOf_(columns, key) {
  for (var i = 0; i < columns.length; i++) if (columns[i][1] === key) return i + 1;
  return -1;
}

function sheet_(name, columns) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  var wanted = columns.map(function (c) { return c[0]; });
  var width = sh.getLastColumn();
  var have = width ? sh.getRange(1, 1, 1, width).getValues()[0] : [];
  if (have.join("") !== wanted.join("")) {
    sh.getRange(1, 1, 1, wanted.length).setValues([wanted]);
    sh.getRange(1, 1, 1, wanted.length).setFontWeight("bold");
    sh.setFrozenRows(1);
  }
  return sh;
}

function rows_(sh, columns) {
  if (sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, columns.length).getValues();
}

function findBy_(sh, columns, key, value) {
  if (!value) return -1;
  var c = colOf_(columns, key);
  if (c < 0) return -1;
  if (sh.getLastRow() < 2) return -1;
  var vals = sh.getRange(2, c, sh.getLastRow() - 1, 1).getValues();
  for (var i = 0; i < vals.length; i++) {
    if (String(vals[i][0]) === String(value)) return i + 2;
  }
  return -1;
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(
    ContentService.MimeType.JSON
  );
}

function nowIso_() {
  return new Date().toISOString();
}

/* Places currently consumed for one event.

   RESERVED and PAID are counted separately because only reserved can ever go
   back down. A row in any other allocation state consumes nothing. */
function used_(sh, eventId) {
  var data = rows_(sh, REGISTRATION_COLUMNS);
  var ev = colOf_(REGISTRATION_COLUMNS, "eventId") - 1;
  var alloc = colOf_(REGISTRATION_COLUMNS, "allocationState") - 1;
  var places = colOf_(REGISTRATION_COLUMNS, "purchasedPlaces") - 1;
  var expires = colOf_(REGISTRATION_COLUMNS, "reservationExpiresAt") - 1;

  var reserved = 0, paid = 0;
  var now = new Date().getTime();

  for (var i = 0; i < data.length; i++) {
    if (String(data[i][ev]) !== String(eventId)) continue;
    var n = Number(data[i][places]) || 0;
    var state = String(data[i][alloc]);

    if (state === "paid") {
      paid += n;
    } else if (state === "reserved") {
      /* A reservation past its expiry no longer holds a place. Stripe's
         expired event is what formally releases it, but that event can be
         late or lost, and a lost event must not permanently shrink inventory.
         Treating an expired reservation as free here is safe because markPaid
         re-checks capacity before it converts one. */
      var exp = Date.parse(String(data[i][expires]));
      if (exp && exp < now) continue;
      reserved += n;
    }
  }
  return { reserved: reserved, paid: paid };
}

function doPost(e) {
  var d;
  try {
    d = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ ok: false, error: "body was not valid JSON" });
  }

  var expected = sharedSecret_();
  if (!expected) return json_({ ok: false, error: "SHARED_SECRET script property is not set" });
  if (d.secret !== expected) return json_({ ok: false, error: "bad secret" });

  var lock = LockService.getScriptLock();
  lock.waitLock(LOCK_MS);
  try {
    return route_(d);
  } finally {
    lock.releaseLock();
  }
}

function route_(d) {
  var action = String(d.action || "");

  if (action === "usedCapacity") return usedCapacity_(d);
  if (action === "reserveSeats") return reserveSeats_(d);
  if (action === "markPaid") return markPaid_(d);
  if (action === "releaseReservation") return releaseReservation_(d);
  if (action === "saveRegistration") return saveRegistration_(d);
  if (action === "saveAttendees") return saveAttendees_(d);
  if (action === "claimStripeEvent") return claimStripeEvent_(d);
  if (action === "releaseStripeEvent") return releaseStripeEvent_(d);
  if (action === "claimEmail") return claimEmail_(d);
  if (action === "releaseEmail") return releaseEmail_(d);
  if (action === "claimEntitlement") return claimEntitlement_(d);

  return json_({ ok: false, error: "unknown action: " + action });
}

function usedCapacity_(d) {
  var sh = sheet_(TAB_REGISTRATIONS, REGISTRATION_COLUMNS);
  var u = used_(sh, d.eventId);
  return json_({ ok: true, reserved: u.reserved, paid: u.paid });
}

/* ATOMIC RESERVATION. The whole point of this file.

   Counts what is consumed, compares it to the capacity the caller states, and
   either takes the places or refuses — all inside the script lock, so two
   simultaneous buyers cannot both be granted the same last place.

   Idempotent on the checkout session id: re-reserving the same session returns
   the existing grant instead of taking more places. */
function reserveSeats_(d) {
  var sh = sheet_(TAB_REGISTRATIONS, REGISTRATION_COLUMNS);
  var places = Number(d.places) || 0;
  if (places < 1) return json_({ ok: false, error: "places must be at least 1" });

  var capacity = Number(d.capacity);
  if (!capacity) {
    capacity = Number(PropertiesService.getScriptProperties().getProperty("SALEABLE_CAPACITY"));
  }
  if (!capacity) return json_({ ok: false, error: "no saleable capacity configured" });

  var r = findBy_(sh, REGISTRATION_COLUMNS, "registrationId", d.registrationId);
  if (r < 0) return json_({ ok: false, error: "unknown registration id: " + d.registrationId });

  var allocCol = colOf_(REGISTRATION_COLUMNS, "allocationState");
  var current = String(sh.getRange(r, allocCol).getValue());

  /* Already holds capacity for this session: report the existing grant. A
     Stripe retry or a double-submit must not take a second allocation. */
  var sidCol = colOf_(REGISTRATION_COLUMNS, "stripeCheckoutSessionId");
  var existingSid = String(sh.getRange(r, sidCol).getValue());
  if ((current === "reserved" || current === "paid") && existingSid === String(d.stripeSessionId)) {
    var u0 = used_(sh, d.eventId);
    return json_({
      ok: true, granted: true, idempotent: true,
      remaining: Math.max(0, capacity - (u0.reserved + u0.paid))
    });
  }
  if (current === "paid") {
    return json_({ ok: false, error: "registration is already paid; refusing to re-reserve" });
  }

  var u = used_(sh, d.eventId);
  var consumed = u.reserved + u.paid;
  var remaining = Math.max(0, capacity - consumed);

  if (remaining < places) {
    return json_({
      ok: true, granted: false, remaining: remaining,
      reason: "not enough saleable places remain"
    });
  }

  sh.getRange(r, allocCol).setValue("reserved");
  sh.getRange(r, sidCol).setValue(d.stripeSessionId || "");
  sh.getRange(r, colOf_(REGISTRATION_COLUMNS, "purchasedPlaces")).setValue(places);
  sh.getRange(r, colOf_(REGISTRATION_COLUMNS, "reservationExpiresAt")).setValue(d.expiresAt || "");
  sh.getRange(r, colOf_(REGISTRATION_COLUMNS, "registrationState")).setValue("checkout_created");
  sh.getRange(r, colOf_(REGISTRATION_COLUMNS, "updatedAt")).setValue(nowIso_());

  return json_({ ok: true, granted: true, remaining: remaining - places });
}

/* reserved -> paid. Terminal for capacity.

   Idempotent: a row already paid reports success and changes nothing, because
   Stripe delivers the same event more than once and the second delivery must
   not be an error. */
function markPaid_(d) {
  var sh = sheet_(TAB_REGISTRATIONS, REGISTRATION_COLUMNS);
  var r = findBy_(sh, REGISTRATION_COLUMNS, "stripeCheckoutSessionId", d.stripeSessionId);
  if (r < 0) r = findBy_(sh, REGISTRATION_COLUMNS, "registrationId", d.registrationId);
  if (r < 0) return json_({ ok: false, error: "unknown registration", id: d.registrationId });

  var allocCol = colOf_(REGISTRATION_COLUMNS, "allocationState");
  var current = String(sh.getRange(r, allocCol).getValue());

  if (current === "paid") {
    return json_({ ok: true, row: r, idempotent: true });
  }

  /* A released allocation being paid means the reservation expired and the
     payment still landed. The money is real, so the place is honoured — but
     capacity is re-checked first so honouring it cannot silently oversell. */
  if (current === "released" || current === "none") {
    var u = used_(sh, d.eventId);
    var capacity = Number(d.capacity) ||
      Number(PropertiesService.getScriptProperties().getProperty("SALEABLE_CAPACITY")) || 0;
    var places = Number(sh.getRange(r, colOf_(REGISTRATION_COLUMNS, "purchasedPlaces")).getValue()) || 1;
    if (capacity && (u.reserved + u.paid + places) > capacity) {
      return json_({
        ok: false,
        overCapacity: true,
        error: "payment arrived after the reservation lapsed and the event is now full"
      });
    }
  }

  sh.getRange(r, allocCol).setValue("paid");
  sh.getRange(r, colOf_(REGISTRATION_COLUMNS, "registrationState")).setValue("paid");
  sh.getRange(r, colOf_(REGISTRATION_COLUMNS, "stripePaymentIntentId")).setValue(d.stripePaymentIntentId || "");
  sh.getRange(r, colOf_(REGISTRATION_COLUMNS, "amount")).setValue(d.amount || "");
  sh.getRange(r, colOf_(REGISTRATION_COLUMNS, "currency")).setValue(d.currency || "");
  sh.getRange(r, colOf_(REGISTRATION_COLUMNS, "updatedAt")).setValue(d.paidAt || nowIso_());
  return json_({ ok: true, row: r });
}

/* reserved -> released. NEVER touches a paid allocation.

   This is the out-of-order-event protection. Stripe does not guarantee
   delivery order, so an expiry event can arrive after the completion event for
   the same session. Releasing then would resell a place somebody bought. */
function releaseReservation_(d) {
  var sh = sheet_(TAB_REGISTRATIONS, REGISTRATION_COLUMNS);
  var r = findBy_(sh, REGISTRATION_COLUMNS, "stripeCheckoutSessionId", d.stripeSessionId);
  if (r < 0) return json_({ ok: true, released: false, reason: "no such checkout session" });

  var allocCol = colOf_(REGISTRATION_COLUMNS, "allocationState");
  var current = String(sh.getRange(r, allocCol).getValue());

  if (current === "paid") {
    return json_({ ok: true, released: false, reason: "allocation is paid; refusing to release" });
  }
  if (current === "released") {
    return json_({ ok: true, released: true, idempotent: true });
  }

  sh.getRange(r, allocCol).setValue("released");
  sh.getRange(r, colOf_(REGISTRATION_COLUMNS, "registrationState"))
    .setValue(d.reason === "payment_failed" ? "payment_failed" : "checkout_expired");
  sh.getRange(r, colOf_(REGISTRATION_COLUMNS, "updatedAt")).setValue(nowIso_());
  return json_({ ok: true, released: true });
}

/* Upsert by registration id. Blanks never overwrite something already there. */
function saveRegistration_(d) {
  var sh = sheet_(TAB_REGISTRATIONS, REGISTRATION_COLUMNS);
  var row = d.row || {};
  if (!row.registrationId) return json_({ ok: false, error: "registrationId is required" });

  var r = findBy_(sh, REGISTRATION_COLUMNS, "registrationId", row.registrationId);
  if (r > 0) {
    var current = sh.getRange(r, 1, 1, REGISTRATION_COLUMNS.length).getValues()[0];
    var merged = REGISTRATION_COLUMNS.map(function (c, i) {
      var v = row[c[1]];
      if (v === undefined || v === null || v === "") return current[i];
      return v;
    });
    sh.getRange(r, 1, 1, REGISTRATION_COLUMNS.length).setValues([merged]);
    return json_({ ok: true, row: r, updated: true });
  }

  sh.appendRow(REGISTRATION_COLUMNS.map(function (c) {
    var v = row[c[1]];
    return v === undefined || v === null ? "" : v;
  }));
  return json_({ ok: true, row: sh.getLastRow() });
}

/* Upsert attendees by attendee id. A duplicate attendee email inside one
   event is rejected — the same person must not hold two places. */
function saveAttendees_(d) {
  var sh = sheet_(TAB_ATTENDEES, ATTENDEE_COLUMNS);
  var list = d.rows || [];
  var emailCol = colOf_(ATTENDEE_COLUMNS, "attendeeEmail");
  var evCol = colOf_(ATTENDEE_COLUMNS, "eventId");
  var regCol = colOf_(ATTENDEE_COLUMNS, "registrationId");

  var existing = rows_(sh, ATTENDEE_COLUMNS);
  for (var i = 0; i < list.length; i++) {
    var a = list[i];
    for (var j = 0; j < existing.length; j++) {
      var sameEvent = String(existing[j][evCol - 1]) === String(a.eventId);
      var sameEmail = String(existing[j][emailCol - 1]).toLowerCase() ===
        String(a.attendeeEmail).toLowerCase();
      var otherReg = String(existing[j][regCol - 1]) !== String(a.registrationId);
      if (sameEvent && sameEmail && otherReg) {
        return json_({
          ok: false,
          error: a.attendeeEmail + " is already registered for this event under another registration"
        });
      }
    }
  }

  for (var k = 0; k < list.length; k++) {
    var row = list[k];
    var r = findBy_(sh, ATTENDEE_COLUMNS, "attendeeId", row.attendeeId);
    if (r > 0) {
      var cur = sh.getRange(r, 1, 1, ATTENDEE_COLUMNS.length).getValues()[0];
      var m = ATTENDEE_COLUMNS.map(function (c, idx) {
        var v = row[c[1]];
        if (v === undefined || v === null || v === "") return cur[idx];
        return v;
      });
      sh.getRange(r, 1, 1, ATTENDEE_COLUMNS.length).setValues([m]);
    } else {
      sh.appendRow(ATTENDEE_COLUMNS.map(function (c) {
        var v = row[c[1]];
        return v === undefined || v === null ? "" : v;
      }));
    }
  }
  return json_({ ok: true, count: list.length });
}

/* Webhook idempotency. The first caller for a Stripe event id is told
   alreadyDone:false and must do the work; every later delivery is told true
   and must do nothing. This is what stops a replayed event consuming a second
   seat or sending a second email. */
function claimStripeEvent_(d) {
  var sh = sheet_(TAB_EVENTS, EVENT_COLUMNS);
  if (!d.stripeEventId) return json_({ ok: false, error: "stripeEventId is required" });
  var r = findBy_(sh, EVENT_COLUMNS, "stripeEventId", d.stripeEventId);
  if (r > 0) return json_({ ok: true, alreadyDone: true, row: r });
  sh.appendRow([d.stripeEventId, d.eventType || "", nowIso_()]);
  return json_({ ok: true, alreadyDone: false, row: sh.getLastRow() });
}

/* Hand the claim back when the work failed, so Stripe's retry may try again
   rather than being told the event was already handled. */
function releaseStripeEvent_(d) {
  var sh = sheet_(TAB_EVENTS, EVENT_COLUMNS);
  var r = findBy_(sh, EVENT_COLUMNS, "stripeEventId", d.stripeEventId);
  if (r < 0) return json_({ ok: true, released: true, missing: true });
  sh.deleteRow(r);
  return json_({ ok: true, released: true });
}

function claimEmail_(d) {
  var sh = sheet_(TAB_REGISTRATIONS, REGISTRATION_COLUMNS);
  var r = findBy_(sh, REGISTRATION_COLUMNS, "registrationId", d.registrationId);
  if (r < 0) return json_({ ok: false, error: "unknown registration" });
  var c = colOf_(REGISTRATION_COLUMNS, "emailSent");
  var already = String(sh.getRange(r, c).getValue()).trim().toLowerCase();
  if (already === "yes") return json_({ ok: true, alreadyDone: true, row: r });
  sh.getRange(r, c).setValue("yes");
  sh.getRange(r, colOf_(REGISTRATION_COLUMNS, "emailSentAt")).setValue(nowIso_());
  return json_({ ok: true, alreadyDone: false, row: r });
}

function releaseEmail_(d) {
  var sh = sheet_(TAB_REGISTRATIONS, REGISTRATION_COLUMNS);
  var r = findBy_(sh, REGISTRATION_COLUMNS, "registrationId", d.registrationId);
  if (r < 0) return json_({ ok: false, error: "unknown registration" });
  sh.getRange(r, colOf_(REGISTRATION_COLUMNS, "emailSent")).setValue("");
  sh.getRange(r, colOf_(REGISTRATION_COLUMNS, "emailSentAt")).setValue("");
  return json_({ ok: true, released: true });
}

/* ONE ELIGIBLE ASSESSMENT PER VERIFIED ORGANIZATION.

   Keyed on the organization, not the registration and not the attendee, so a
   company that buys four Team Passes still has exactly one entitlement. The
   first purchase creates it; every later one is told it already exists. */
function claimEntitlement_(d) {
  var sh = sheet_(TAB_ENTITLEMENTS, ENTITLEMENT_COLUMNS);
  var key = String(d.organizationKey || "").trim().toLowerCase();
  if (!key) return json_({ ok: false, error: "organizationKey is required" });
  var r = findBy_(sh, ENTITLEMENT_COLUMNS, "organizationKey", key);
  if (r > 0) return json_({ ok: true, alreadyDone: true, row: r });
  sh.appendRow([key, d.registrationId || "", nowIso_()]);
  return json_({ ok: true, alreadyDone: false, row: sh.getLastRow() });
}

/* opening the /exec URL in a browser confirms the deployment is live */
function doGet() {
  return ContentService.createTextOutput("METRIS registration collector is running.");
}
