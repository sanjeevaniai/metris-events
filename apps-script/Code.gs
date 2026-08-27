/* Paste this into the Google Sheet that should collect registrations:
     Extensions > Apps Script, replace everything, Save.
     Deploy > New deployment > Web app
       Execute as: Me
       Who has access: Anyone
     Copy the /exec URL into the Vercel env var SHEET_WEBHOOK_URL.

   Set SHARED_SECRET below to a long random string and put the same value in
   the Vercel env var SHEET_SHARED_SECRET. Without it anyone who finds the URL
   can write rows into your sheet. */

var SHARED_SECRET = "CHANGE-ME-to-a-long-random-string";
var SHEET_NAME    = "Registrations";

var HEADERS = ["id","registered","status","paid at","amount","first name","last name",
               "email","job title","company","country","role","headcount","size band",
               "industry","q1 where is AI","q2 who decides","q3 role question",
               "anything to cover","campaign","payment intent","stripe session"];

function sheet_(){
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if(!sh){
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(HEADERS);
    sh.getRange(1,1,1,HEADERS.length).setFontWeight("bold");
    sh.setFrozenRows(1);
  }
  return sh;
}

function findRow_(sh, id){
  if(!id) return -1;
  var ids = sh.getRange(2,1,Math.max(sh.getLastRow()-1,1),1).getValues();
  for(var i=0;i<ids.length;i++){ if(ids[i][0] === id) return i+2; }
  return -1;
}

function doPost(e){
  var out = function(o){
    return ContentService.createTextOutput(JSON.stringify(o))
      .setMimeType(ContentService.MimeType.JSON);
  };

  var d;
  try { d = JSON.parse(e.postData.contents); }
  catch(err){ return out({ ok:false, error:"bad json" }); }

  if(d.secret !== SHARED_SECRET) return out({ ok:false, error:"bad secret" });

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try{
    var sh = sheet_();

    if(d.action === "paid"){
      var r = findRow_(sh, d.id);
      if(r < 0) return out({ ok:false, error:"unknown id", id:d.id });
      sh.getRange(r, 3).setValue("paid");            // status
      sh.getRange(r, 4).setValue(d.stamp || "");     // paid at
      sh.getRange(r, 5).setValue(d.amount || "");    // amount
      sh.getRange(r, 21).setValue(d.paymentIntent || "");
      sh.getRange(r, 22).setValue(d.sessionId || "");
      return out({ ok:true, row:r });
    }

    /* a new registration, written before payment is attempted */
    sh.appendRow([ d.id, d.stamp, d.status || "pending", "", "",
                   d.firstName, d.lastName, d.email, d.jobTitle, d.company,
                   d.country, d.role, d.headcount, d.sizeBand, d.industry,
                   d.q1, d.q2, d.q3, d.openAsk, d.campaign, "", "" ]);
    return out({ ok:true, row: sh.getLastRow() });
  } finally {
    lock.releaseLock();
  }
}

/* lets you confirm the deployment is alive by opening the /exec URL */
function doGet(){
  return ContentService.createTextOutput("METRIS registration collector is running.");
}
