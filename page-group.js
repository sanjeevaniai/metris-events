/* The group page. One template serves every group; which one is decided by the
   path, so adding a group needs no new file.

   Seat is the source of truth throughout. The group is derived from the seat,
   and the only reason the page knows its own slug is to pick the copy and the
   dates. Nothing reads the group to decide what to ask a person. */

(function(){
  var M = window.METRIS, T = window.METRIS_TIME, C = window.METRIS_CONTENT;
  function $(id){ return document.getElementById(id); }
  function esc(s){ var d=document.createElement("div"); d.textContent=s==null?"":s; return d.innerHTML; }
  function missing(what){ return '<em class="tbc">'+esc(what)+'</em>'; }

  var SIZE_BANDS = ["1 to 50","51 to 250","251 to 1,000","1,001 to 5,000","More than 5,000"];
  var COUNTRIES = ["United States","Canada","United Kingdom","India","Australia","Germany","France","Netherlands","Ireland","Singapore","United Arab Emirates","Saudi Arabia","South Africa","Nigeria","Kenya","Brazil","Mexico","Japan","New Zealand","Spain","Italy","Sweden","Switzerland","Other"];

  /* ---------- which group is this ---------- */
  var slug = location.pathname.replace(/^\/+|\/+$/g, "").split("?")[0];
  var group = M.group(slug);
  if(!group){
    document.body.innerHTML =
      '<div class="wrap" style="padding:60px 22px"><h1>No such track.</h1>'+
      '<p><a href="/">Back to the start</a> and pick the seat you sit in.</p></div>';
    return;
  }
  window.METRIS_GROUP = group;   /* the figure component reads this */

  var p = new URLSearchParams(location.search);
  var seatId   = (p.get("seat") || "").trim();
  var leadId   = (p.get("id") || "").trim();
  var campaign = (p.get("c") || "").trim();
  var otherSeatText = (p.get("t") || "").trim();
  var industry = (p.get("i") || "").trim();
  var sizeBand = (p.get("s") || "").trim();

  /* a seat that does not belong to this group is not trusted */
  var seat = M.seat(seatId);
  if(seat){
    var g = M.groupForSeat(seatId);
    if(!g || g.slug !== group.slug) { seat = null; seatId = ""; }
  }

  /* ---------- copy ---------- */
  var seatNames = M.seatsOf(group).map(function(s){ return s.label; });
  $("room").innerHTML = "For " + esc(seatNames.join(", ").replace(/, ([^,]*)$/, " and $1"));
  document.title = "Track " + group.letter + " · METRIS";

  $("title").textContent = group.copy && group.copy.lede
    ? group.copy.lede
    : "AI is already in your organization. What can you actually prove about it?";

  if(group.copy && group.copy.body){
    $("copy").innerHTML = [].concat(group.copy.body).map(function(x){
      return "<p>"+esc(x)+"</p>";
    }).join("");
  } else {
    $("copy").innerHTML = '<div class="missing-copy">Session copy for track '+
      esc(group.letter)+' has not been supplied yet. Add it to <code>copy.body</code> '+
      'for <code>'+esc(group.slug)+'</code> in sessions.js.</div>';
  }

  /* ---------- the three sessions ---------- */
  $("sessions").innerHTML = group.sessions.map(function(s){
    var d = T.describe(s, { timezone: M.TIMEZONE, zones: M.ZONES });
    var layer = (M.LAYERS[s.layer] && M.LAYERS[s.layer].name) || ("Layer " + s.layer);
    var when = d.known ? esc(d.date) : missing("date to be confirmed");
    var len  = d.duration ? esc(d.duration) : missing("length to be confirmed");
    var times = d.known
      ? '<ul class="zones">' + d.times.map(function(t){
          return "<li><b>"+esc(t.time)+" "+esc(t.abbr)+"</b> "+esc(t.label)+"</li>";
        }).join("") + '</ul>'
      : '<p class="len">'+missing("start time to be confirmed")+'</p>';
    /* The joining link is never sent to an unpaid page, so it is not here and
       must not be added. It is released by /api/session after Stripe confirms
       the payment. */
    var join = '<p class="len">Your joining link is emailed when you register.</p>';
    return '<li class="session"><p class="layer">'+esc(layer)+'</p>'+
           '<p class="when">'+when+'</p><p class="len">'+len+'</p>'+times+join+'</li>';
  }).join("");

  /* ---------- the form ---------- */
  $("priceLine").innerHTML = '<span class="amt">'+esc(M.PRICE.display)+'</span>'+
    '<span class="per">Covers all three sessions in this track.</span>';
  $("sizeBand").innerHTML = '<option value="">Select</option>'+
    SIZE_BANDS.map(function(b){ return "<option>"+esc(b)+"</option>"; }).join("");
  $("country").innerHTML = '<option value="">Select</option>'+
    COUNTRIES.map(function(c){ return "<option>"+esc(c)+"</option>"; }).join("");
  $("consent").innerHTML = 'By registering you agree we may contact you about these sessions and related work. Read the <a href="'+esc(C.footer.privacyUrl)+'" target="_blank" rel="noopener">privacy policy</a>.';
  $("footOrg").textContent = C.footer.org;
  $("footLinks").innerHTML =
    '<a href="'+esc(C.footer.privacyUrl)+'">Privacy policy</a>'+
    '<a href="'+esc(C.footer.termsUrl)+'">Terms</a>'+
    '<a href="'+esc(C.footer.linkedin)+'" target="_blank" rel="noopener">LinkedIn</a>';

  /* the panel: one column each, photograph on top, bio scrolling under it */
  $("sideCols").innerHTML = (C.speakers||[]).map(function(s){
    var ini = s.name.split(" ").map(function(w){ return w[0]; }).slice(0,2).join("");
    var av = s.photo ? '<img src="/'+esc(s.photo)+'" alt="'+esc(s.name)+'"/>'
                     : '<div class="avatar" aria-hidden="true">'+esc(ini)+'</div>';
    return '<div class="side-col">'+av+
      '<p class="nm">'+esc(s.name)+'</p>'+
      '<p class="rl">'+esc(s.role)+', '+esc(s.org)+'</p>'+
      '<div class="side-bio-wrap"><div class="side-bio">'+
        [].concat(s.bio||[]).map(function(b){ return '<p>'+esc(b)+'</p>'; }).join('')+
      '</div></div>'+
      (s.linkedin ? '<a href="'+esc(s.linkedin)+'" target="_blank" rel="noopener">LinkedIn</a>' : '')+
      '</div>';
  }).join("");

  /* the same price and a way to act, below both columns and outside their scroll */
  $("sideCta").innerHTML =
    '<span class="amt">'+esc(M.PRICE.display)+'</span>'+
    '<span class="per">Covers all three sessions in this track.</span>'+
    '<a href="#register">Register</a>';

  /* Each column says for itself whether there is more to read. The fade lifts at
     the end of that bio, and is not drawn when the column does not overflow, so
     it never claims text that is not there. */
  (function(){
    var wraps = Array.prototype.slice.call(document.querySelectorAll(".side-bio-wrap"));
    function sync(){
      wraps.forEach(function(w){
        var box = w.querySelector(".side-bio");
        var scrolls = box.scrollHeight > box.clientHeight + 2;
        var atEnd = box.scrollTop + box.clientHeight >= box.scrollHeight - 4;
        w.classList.toggle("at-end", !scrolls || atEnd);
      });
    }
    wraps.forEach(function(w){ w.querySelector(".side-bio").addEventListener("scroll", sync); });
    window.addEventListener("resize", sync);
    setTimeout(sync, 60);
    sync();
  })();

  if(C.speakerNote) $("speakerNote").textContent = C.speakerNote;

  /* ---------- seat, carried over or asked for ---------- */
  function seatTiles(){
    $("tiles").innerHTML = M.seatsOf(group).map(function(s){
      return '<button type="button" class="tile" data-id="'+s.id+'" aria-pressed="false">'+esc(s.label)+'</button>';
    }).join("");
  }
  function paintSlug(){
    var bits = ["<b>"+esc(seat.label)+"</b>"];
    if(industry) bits.push("in "+esc(industry));
    if(sizeBand) bits.push("at a company of "+esc(sizeBand)+" people");
    $("slugText").innerHTML = bits.join(", ");
    $("slug").hidden = false;
  }
  $("slugEdit").addEventListener("click", function(){
    $("slug").hidden = true; $("rolePick").hidden = false; $("segFields").hidden = false;
    seatTiles();
    var t = $("tiles").querySelector('[data-id="'+seatId+'"]'); if(t) t.click();
  });
  $("tiles").addEventListener("click", function(e){
    var t = e.target.closest(".tile"); if(!t) return;
    Array.prototype.forEach.call(this.querySelectorAll(".tile"), function(b){
      b.setAttribute("aria-pressed","false");
    });
    t.setAttribute("aria-pressed","true");
    seatId = t.dataset.id; seat = M.seat(seatId);
    paintQuestions();
  });

  if(industry) $("industry").value = industry;
  if(sizeBand) $("sizeBand").value = sizeBand;
  if(!industry || !sizeBand) $("segFields").hidden = false;
  if(seat){ paintSlug(); } else { $("rolePick").hidden = false; seatTiles(); }

  /* ---------- the three questions: q1 and q2 shared, q3 by SEAT ---------- */
  var A = { q1:"", q2:"", q3:"" };

  function paintQuestions(){
    if(!seat){ $("questions").innerHTML = ""; A = {q1:"",q2:"",q3:""}; return; }
    var list = [
      { key:"q1", label:M.SHARED_QUESTIONS.q1.label, options:M.SHARED_QUESTIONS.q1.options,
        multi:M.SHARED_QUESTIONS.q1.multi, other:M.SHARED_QUESTIONS.q1.other,
        exclusive:M.SHARED_QUESTIONS.q1.exclusive },
      { key:"q2", label:M.SHARED_QUESTIONS.q2.label, options:M.SHARED_QUESTIONS.q2.options,
        multi:M.SHARED_QUESTIONS.q2.multi, other:M.SHARED_QUESTIONS.q2.other,
        exclusive:M.SHARED_QUESTIONS.q2.exclusive },
      { key:"q3", label:seat.q, options:seat.options, multi:seat.multi, other:seat.other,
        exclusive:seat.exclusive, textarea:seat.textarea, placeholder:seat.placeholder }
    ];
    $("questions").innerHTML = list.map(function(q,i){
      if(q.textarea){
        return '<div class="q" data-q="'+q.key+'"><span class="q-label" id="l'+i+'">'+esc(q.label)+'</span>'+
          '<textarea data-key="'+q.key+'" aria-labelledby="l'+i+'" placeholder="'+esc(q.placeholder||"")+'"></textarea></div>';
      }
      var opts = (q.options||[]).slice();
      if(q.other) opts.push("Other");
      var type = q.multi ? "checkbox" : "radio";
      var rows = opts.map(function(o){
        var flags = (q.exclusive && q.exclusive.indexOf(o) > -1 ? ' data-x="1"' : '') +
                    (o === "Other" ? ' data-other="1"' : '');
        return '<label class="opt"><input type="'+type+'" name="'+q.key+'" value="'+esc(o)+'"'+flags+
               '/> <span>'+esc(o)+'</span></label>';
      }).join("");
      return '<div class="q" data-q="'+q.key+'"><span class="q-label">'+esc(q.label)+'</span>'+
        (q.multi ? '<p class="q-hint">Tick everything that applies.</p>' : '')+
        '<div class="opts" role="'+(q.multi?"group":"radiogroup")+'" aria-label="'+esc(q.label)+'">'+rows+'</div>'+
        (q.other ? '<div class="other-wrap" hidden><label class="other-lab" for="ot-'+q.key+'">Tell us</label>'+
          '<input type="text" class="other-text" id="ot-'+q.key+'" placeholder="A few words is plenty." /></div>' : '')+
        '</div>';
    }).join("");
    A = readAnswers();
  }

  function applyExclusive(inp){
    if(inp.type !== "checkbox" || !inp.checked) return;
    var mine = inp.dataset.x === "1";
    Array.prototype.forEach.call(inp.closest(".opts").querySelectorAll('input[type=checkbox]'), function(b){
      if(b === inp) return;
      if(mine || b.dataset.x === "1") b.checked = false;
    });
  }
  function paintPicked(grp){
    Array.prototype.forEach.call(grp.querySelectorAll(".opt"), function(l){
      l.classList.toggle("is-picked", !!l.querySelector("input").checked);
    });
  }
  function syncOther(wrap){
    var o = wrap.querySelector('input[data-other="1"]'), box = wrap.querySelector(".other-wrap");
    if(!o || !box) return;
    box.hidden = !o.checked;
    if(!o.checked){ var t = box.querySelector(".other-text"); if(t) t.value = ""; }
  }
  function readAnswers(){
    var out = { q1:"", q2:"", q3:"" };
    ["q1","q2","q3"].forEach(function(k){
      var wrap = $("questions").querySelector('[data-q="'+k+'"]'); if(!wrap) return;
      var ta = wrap.querySelector('textarea[data-key="'+k+'"]');
      if(ta){ out[k] = ta.value.trim(); return; }
      var txt = wrap.querySelector(".other-text"), vals = [];
      Array.prototype.forEach.call(wrap.querySelectorAll("input:checked"), function(i){
        if(i.dataset.other === "1"){
          var v = txt ? txt.value.trim() : "";
          vals.push(v ? "Other: " + v : "Other");
        } else vals.push(i.value);
      });
      out[k] = vals.join("; ");
    });
    return out;
  }
  function otherBlank(){
    var qs = $("questions").querySelectorAll(".q");
    for(var i=0;i<qs.length;i++){
      var o = qs[i].querySelector('input[data-other="1"]'), t = qs[i].querySelector(".other-text");
      if(o && o.checked && t && !t.value.trim()) return true;
    }
    return false;
  }
  $("questions").addEventListener("change", function(e){
    var inp = e.target;
    if(inp.type !== "radio" && inp.type !== "checkbox") return;
    applyExclusive(inp);
    paintPicked(inp.closest(".opts"));
    syncOther(inp.closest(".q"));
    A = readAnswers();
    if(inp.dataset.other === "1" && inp.checked){
      var t = inp.closest(".q").querySelector(".other-text"); if(t) t.focus();
    }
  });
  $("questions").addEventListener("input", function(e){
    if(e.target.tagName === "TEXTAREA" || e.target.classList.contains("other-text")) A = readAnswers();
  });
  $("sizeBand").addEventListener("change", function(){ sizeBand = this.value; });
  paintQuestions();

  if(p.get("cancelled")){
    var e0 = $("err"); e0.hidden = false;
    e0.textContent = "Payment was cancelled, so the seat is not booked yet. Your answers are still here — press Register and pay when you are ready.";
  }

  /* ---------- submit: register first, pay second ---------- */
  $("send").addEventListener("click", async function(){
    var err = $("err"), btn = this;
    function fail(m){ err.hidden=false; err.textContent=m; err.scrollIntoView({block:"center"}); }

    if(!seat) return fail("Pick the seat you sit in, then register.");
    var data = {
      stage: "registration",
      id: leadId,
      seat: seatId,
      name: [$("firstName").value.trim(), $("lastName").value.trim()].filter(Boolean).join(" "),
      email: $("email").value.trim(),
      jobTitle: $("jobTitle").value.trim(),
      company: $("company").value.trim(),
      country: $("country").value,
      industry: $("industry").value.trim() || industry,
      sizeBand: $("sizeBand").value || sizeBand,
      campaign: campaign,
      answer1: A.q1, answer2: A.q2, answer3: A.q3,
      openAsk: $("openAsk").value.trim()
    };

    if(!data.industry || !data.sizeBand) return fail("Industry and company size are still blank.");
    if(!A.q1 || !A.q2 || !A.q3) return fail("Three questions above are still unanswered.");
    if(otherBlank()) return fail("You picked Other. Tell us what you mean in the box, then register.");
    var miss = ["firstName","lastName","email","jobTitle","company","country"].filter(function(k){
      return !$(k).value.trim();
    });
    if(miss.length) return fail("Fill in every field marked with a star, then register.");
    if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.email)) return fail("That email address does not look complete.");

    /* STEP ONE: the lead is recorded with paid = no. Nothing is charged until
       this has succeeded, so an abandoned payment still leaves a lead behind. */
    err.hidden = true; btn.disabled = true; btn.textContent = "Registering";
    var reg;
    try{
      var r1 = await fetch("/api/register", {
        method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(data)
      });
      reg = null; try{ reg = await r1.json(); }catch(e){}
      if(!r1.ok || !reg || reg.ok !== true){
        throw new Error((reg && reg.error) || ("The server answered "+r1.status+" "+r1.statusText+"."));
      }
    }catch(e){
      btn.disabled = false; btn.textContent = "Register and pay";
      return fail((e && e.message ? e.message : "That did not go through, and nothing was recorded.")+
        " You have not been charged. Try once more, and if it fails again write to "+
        C.footer.replyTo+" and you will be registered by hand.");
    }

    /* STEP TWO: only now, take the money. */
    btn.textContent = "Taking you to payment";
    try{
      var r2 = await fetch("/api/checkout", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify(Object.assign({}, data, { id: reg.id || leadId }))
      });
      var pay = null; try{ pay = await r2.json(); }catch(e){}
      if(!r2.ok || !pay || pay.ok !== true || !pay.url){
        throw new Error((pay && pay.error) || ("The server answered "+r2.status+" "+r2.statusText+"."));
      }
      window.location.assign(pay.url);
    }catch(e){
      btn.disabled = false; btn.textContent = "Register and pay";
      fail("Your details are saved and you have not been charged, but the payment page would not open. "+
           (e && e.message ? e.message : "")+
           " Try once more, or write to "+C.footer.replyTo+" and we will send you a payment link.");
    }
  });
})();
