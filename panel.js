/* The panel that sits beside the argument, on page one and on every group page.
   One copy, so the two cannot drift apart.

   Two sentences per person here; the whole bio is behind Read more, in a dialog,
   because at 340px the full text would push the price and the button off the
   screen. Everything anyone might want is in the full version, which matters for
   people new to this material. */

(function(){
  var C = window.METRIS_CONTENT, M = window.METRIS;
  if(!C || !document.getElementById("sidePeople")) return;

  function $(id){ return document.getElementById(id); }
  function esc(s){ var d=document.createElement("div"); d.textContent=s==null?"":s; return d.innerHTML; }

  var LI_ICON = '<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true">'+
    '<path d="M4.98 3.5C4.98 4.88 3.87 6 2.5 6S0 4.88 0 3.5 1.12 1 2.5 1 4.98 2.12 4.98 3.5zM.02 8.02h4.96V24H.02V8.02zM8.98 8.02h4.75v2.18h.07c.66-1.25 2.27-2.57 4.68-2.57 5 0 5.93 3.29 5.93 7.57V24h-4.96v-7.87c0-1.88-.03-4.3-2.62-4.3-2.62 0-3.02 2.05-3.02 4.16V24H8.98V8.02z"/></svg>';

  $("sidePeople").innerHTML = (C.speakers||[]).map(function(s, i){
    var ini = s.name.split(" ").map(function(w){ return w[0]; }).slice(0,2).join("");
    var av = s.photo ? '<img src="/'+esc(s.photo)+'" alt="'+esc(s.name)+'"/>'
                     : '<div class="avatar" aria-hidden="true">'+esc(ini)+'</div>';
    var li = s.linkedin
      ? '<a class="li" href="'+esc(s.linkedin)+'" target="_blank" rel="noopener" '+
        'aria-label="'+esc(s.name)+' on LinkedIn" title="LinkedIn">'+LI_ICON+'</a>'
      : '';
    return '<div class="side-person"><div class="who">'+av+
      '<div><p class="nm">'+esc(s.name)+li+'</p>'+
      '<p class="rl">'+esc(s.role)+', '+esc(s.org)+'</p></div></div>'+
      (s.shortBio ? '<p class="sb">'+esc(s.shortBio)+'</p>' : '')+
      ((s.bio && s.bio.length)
        ? '<button type="button" class="read-more" data-i="'+i+'">Read more</button>' : '')+
      '</div>';
  }).join("");

  if($("sideCta") && M){
    $("sideCta").innerHTML =
      '<span class="amt">'+esc(M.PRICE.display)+'</span>'+
      '<span class="per">One 90-minute session.</span>'+
      '<a href="#register">Register</a>';
  }

  /* the full bio, in a native dialog: Escape closes it, focus is trapped, and
     the backdrop comes for free */
  var dlg = $("bioDialog");
  if(!dlg) return;

  function open(i){
    var s = (C.speakers||[])[i]; if(!s) return;
    var img = $("bioPhoto");
    img.src = s.photo ? "/"+s.photo : "";
    img.alt = s.name;
    img.style.display = s.photo ? "" : "none";
    $("bioName").textContent = s.name;
    $("bioRole").textContent = s.role + ", " + s.org;
    var a = $("bioLinked");
    if(s.linkedin){ a.href = s.linkedin; a.hidden = false; } else { a.hidden = true; }
    $("bioBody").innerHTML = [].concat(s.bio).map(function(b){ return "<p>"+esc(b)+"</p>"; }).join("");
    if(typeof dlg.showModal === "function") dlg.showModal(); else dlg.setAttribute("open","");
    $("bioClose").focus();
  }

  $("sidePeople").addEventListener("click", function(e){
    var b = e.target.closest(".read-more"); if(!b) return;
    open(parseInt(b.dataset.i, 10));
  });
  $("bioClose").addEventListener("click", function(){ dlg.close(); });
  /* the backdrop is the dialog element itself, outside its box */
  dlg.addEventListener("click", function(e){ if(e.target === dlg) dlg.close(); });
})();
