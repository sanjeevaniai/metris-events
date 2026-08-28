/* Collects registrations into this sheet, and marks them paid when Stripe says
   the money arrived.

   Install:
     Extensions > Apps Script, replace everything with this file, Save.
     Deploy > New deployment > Web app
       Execute as: Me
       Who has access: Anyone
     Put the /exec URL in SHEET_WEBHOOK_URL.

   After ANY edit here, publish a new version or the deployment keeps serving the
   old code: Deploy > Manage deployments > pencil > Version: New version.

   SHARED_SECRET must match the SHEET_SHARED_SECRET env var. The /exec URL has to
   be readable by anyone, so this is what stops strangers writing to your sheet. */

var SHARED_SECRET = "REDACTED-SET-VIA-SCRIPT-PROPERTY";
var SHEET_NAME    = "Entries";

/* [heading, key in the posted JSON] - one list, so headings and values cannot
   drift apart. Add a column by adding a line. */
var COLUMNS = [
  ["id",                "id"],
  ["timestamp",         "timestamp"],
  ["stage",             "stage"],
  ["seat",              "seat"],
  ["seat label",        "seatLabel"],
  ["group",             "group"],
  ["session_slug",      "sessionSlug"],
  ["layer",             "layer"],
  ["name",              "name"],
  ["email",             "email"],
  ["job title",         "jobTitle"],
  ["company",           "company"],
  ["country",           "country"],
  ["role",              "role"],
  ["headcount",         "headcount"],
  ["size band",         "sizeBand"],
  ["industry",          "industry"],
  ["campaign",          "campaign"],
  ["answer1",           "answer1"],
  ["answer2",           "answer2"],
  ["answer3",           "answer3"],
  ["anything to cover", "openAsk"],
  ["paid",              "paid"],
  ["paid at",           "paidAt"],
  ["amount",            "amount"],
  ["stripe_session_id", "stripe_session_id"]
];

function col_(key){
  for(var i=0;i<COLUMNS.length;i++){ if(COLUMNS[i][1] === key) return i+1; }
  return -1;
}

function sheet_(){
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if(!sh){
    sh = ss.insertSheet(SHEET_NAME);
  }
  var wanted = COLUMNS.map(function(c){ return c[0]; });
  var width  = sh.getLastColumn();
  var have   = width ? sh.getRange(1,1,1,width).getValues()[0] : [];
  if(have.join("") !== wanted.join("")){
    sh.getRange(1,1,1,wanted.length).setValues([wanted]);
    sh.getRange(1,1,1,wanted.length).setFontWeight("bold");
    sh.setFrozenRows(1);
  }
  return sh;
}

function findRow_(sh, id){
  if(!id || sh.getLastRow() < 2) return -1;
  var ids = sh.getRange(2,1,sh.getLastRow()-1,1).getValues();
  for(var i=0;i<ids.length;i++){ if(String(ids[i][0]) === String(id)) return i+2; }
  return -1;
}

function json_(o){
  return ContentService.createTextOutput(JSON.stringify(o))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e){
  var d;
  try { d = JSON.parse(e.postData.contents); }
  catch(err){ return json_({ ok:false, error:"body was not valid JSON" }); }

  if(d.secret !== SHARED_SECRET) return json_({ ok:false, error:"bad secret" });

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try{
    var sh = sheet_();

    /* Stripe confirmed a payment: find the row and mark it */
    if(d.action === "paid"){
      var r = findRow_(sh, d.id);
      if(r < 0) return json_({ ok:false, error:"unknown id", id:d.id });
      sh.getRange(r, col_("paid")).setValue("yes");
      sh.getRange(r, col_("paidAt")).setValue(d.paidAt || new Date().toISOString());
      sh.getRange(r, col_("amount")).setValue(d.amount || "");
      sh.getRange(r, col_("stripe_session_id")).setValue(d.stripe_session_id || "");
      return json_({ ok:true, row:r });
    }

    if(!d.id)        d.id = Utilities.getUuid();
    if(!d.timestamp) d.timestamp = new Date();
    if(!d.paid)      d.paid = "no";
    if(!d.stage)     d.stage = "registration";

    /* Page one writes a filter row and hands its id to the group page, which
       sends it back. Same id means the same person, so the row is filled in
       rather than duplicated. Blanks never overwrite something already there. */
    var existing = findRow_(sh, d.id);
    if(existing > 0){
      var current = sh.getRange(existing, 1, 1, COLUMNS.length).getValues()[0];
      var merged = COLUMNS.map(function(c, i){
        var v = d[c[1]];
        if(v === undefined || v === null || v === "") return current[i];
        return v;
      });
      sh.getRange(existing, 1, 1, COLUMNS.length).setValues([merged]);
      return json_({ ok:true, row: existing, id: d.id, updated: true });
    }

    sh.appendRow(COLUMNS.map(function(c){
      var v = d[c[1]];
      return (v === undefined || v === null) ? "" : v;
    }));
    return json_({ ok:true, row: sh.getLastRow(), id: d.id });
  } finally {
    lock.releaseLock();
  }
}

/* opening the /exec URL in a browser confirms the deployment is live */
function doGet(){
  return ContentService.createTextOutput("METRIS registration collector is running.");
}
