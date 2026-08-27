/* Collects registrations from api/register.js into this sheet.

   To install:
     Extensions > Apps Script, replace everything with this file, Save.
     Deploy > New deployment > Web app
       Execute as: Me
       Who has access: Anyone
     Copy the /exec URL into SHEET_WEBHOOK_URL.

   After ANY edit here you must publish a new version, or the deployment keeps
   serving the old code: Deploy > Manage deployments > pencil > New version.

   Set SHARED_SECRET below to the same value as the SHEET_SHARED_SECRET env var.
   The /exec URL has to be readable by anyone, so this is what stops strangers
   writing rows into your sheet. */

var SHARED_SECRET = "CHANGE-ME-to-a-long-random-string";
var SHEET_NAME    = "Registrations";

/* column order of the sheet; each entry is [heading, key in the posted JSON] */
var COLUMNS = [
  ["id",              "id"],
  ["received",        "receivedAt"],
  ["status",          "status"],
  ["name",            "name"],
  ["email",           "email"],
  ["job title",       "jobTitle"],
  ["company",         "company"],
  ["country",         "country"],
  ["role",            "role"],
  ["headcount",       "headcount"],
  ["size band",       "sizeBand"],
  ["industry",        "industry"],
  ["q1 where is AI",  "answer1"],
  ["q2 who decides",  "answer2"],
  ["q3 role question","answer3"],
  ["anything to cover","openAsk"],
  ["campaign",        "campaign"],
  ["paid at",         "paidAt"],
  ["amount",          "amount"],
  ["payment ref",     "paymentIntent"]
];

function sheet_(){
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if(!sh){
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(COLUMNS.map(function(c){ return c[0]; }));
    sh.getRange(1,1,1,COLUMNS.length).setFontWeight("bold");
    sh.setFrozenRows(1);
  }
  return sh;
}

function findRow_(sh, id){
  if(!id || sh.getLastRow() < 2) return -1;
  var ids = sh.getRange(2,1,sh.getLastRow()-1,1).getValues();
  for(var i=0;i<ids.length;i++){ if(ids[i][0] === id) return i+2; }
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

    /* used later, when something marks a registration paid */
    if(d.action === "paid"){
      var r = findRow_(sh, d.id);
      if(r < 0) return json_({ ok:false, error:"unknown id", id:d.id });
      sh.getRange(r, 3).setValue("paid");
      sh.getRange(r, 18).setValue(d.paidAt || d.stamp || new Date().toISOString());
      sh.getRange(r, 19).setValue(d.amount || "");
      sh.getRange(r, 20).setValue(d.paymentIntent || "");
      return json_({ ok:true, row:r });
    }

    if(!d.id)         d.id = Utilities.getUuid();
    if(!d.receivedAt) d.receivedAt = new Date().toISOString();
    if(!d.status)     d.status = "registered";

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
