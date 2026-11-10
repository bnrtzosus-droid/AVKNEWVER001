(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); };

  /* ---------- mobile side menu ---------- */
  function setNav(open) {
    var nav = $("#mobnav"), b = $("#burger");
    if (nav) nav.classList.toggle("open", open);
    if (b) b.setAttribute("aria-expanded", open ? "true" : "false");
    document.body.style.overflow = open ? "hidden" : "";
    if (!open) {
      var s = $("#msubs"), pl = $(".msub");
      if (s) s.classList.remove("open");
      if (pl) { pl.textContent = "+"; pl.setAttribute("aria-expanded", "false"); }
    }
  }

  /* ---------- team biography dialog (cabinet page) ---------- */
  function closeBio() {
    var r = $("#bio-root");
    if (r && r.innerHTML) { r.innerHTML = ""; document.body.style.overflow = ""; }
  }
  function openBio(i) {
    var b = (window.PA_BIOS || [])[i];
    if (!b) return;
    var h = "";
    b.blocks.forEach(function (x) {
      h += '<div><p style="margin:0">' + esc(x.text) + "</p>";
      if (x.hasItems) h += '<ul style="margin:8px 0 0;padding-left:22px;display:flex;flex-direction:column;gap:4px">' + x.items.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + "</ul>";
      h += "</div>";
    });
    $("#bio-root").innerHTML =
      '<div id="bio-bg" role="dialog" aria-modal="true" aria-label="' + esc(b.name) + '" style="position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:100;display:flex;align-items:center;justify-content:center;padding:24px">' +
      '<div style="background:#fff;border-radius:10px;max-width:880px;width:100%;max-height:90vh;overflow:auto;position:relative;display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:28px;padding:32px">' +
      '<button id="bio-x" aria-label="Fermer" style="position:absolute;top:10px;right:14px;background:none;border:0;font-size:28px;color:#666;cursor:pointer;line-height:1">×</button>' +
      (b.photo ? '<img src="' + esc(b.photo) + '" alt="' + esc(b.name) + '" style="width:100%;border-radius:8px;object-fit:cover;background:#dde9ec;aspect-ratio:4/5">' : "") +
      '<div style="display:flex;flex-direction:column;gap:12px;font-size:15px"><h3 style="margin:0;font-size:24px;font-weight:700;color:#428c9e">' + esc(b.name) + "</h3>" + h +
      '<div><a href="/rendez-vous" style="display:inline-block;margin-top:6px;background:#428c9e;color:#fff;border-radius:100px;padding:10px 26px;font-size:16px;font-weight:500;border:1px solid #428c9e">' + esc(b.cta) + "</a></div></div></div></div>";
    document.body.style.overflow = "hidden";
    $("#bio-bg").addEventListener("click", function (e) { if (e.target === this) closeBio(); });
    $("#bio-x").addEventListener("click", closeBio);
    $("#bio-x").focus();
  }

  /* ---------- delegated clicks ---------- */
  document.addEventListener("click", function (e) {
    var t = e.target.closest ? e.target.closest("[data-bio],[data-scroll],#burger,.mclose,.msub,#mobpanel a,#mobnav") : null;
    if (!t) return;
    if (t.id === "burger") { setNav(true); return; }
    if (t.classList.contains("msub")) {
      var s = $("#msubs"), open = !s.classList.contains("open");
      s.classList.toggle("open", open);
      t.textContent = open ? "−" : "+";
      t.setAttribute("aria-expanded", open ? "true" : "false");
      return;
    }
    if (t.id === "mobnav") { if (e.target === t) setNav(false); return; }
    if (t.classList.contains("mclose") || (t.tagName === "A" && t.closest("#mobpanel"))) { setNav(false); return; }
    if (t.hasAttribute("data-bio")) { e.preventDefault(); openBio(+t.getAttribute("data-bio")); return; }
    var sec = t.closest("section"), track = sec && $(".pa-track", sec);
    if (track) {
      var it = track.firstElementChild;
      track.scrollBy({ left: +t.getAttribute("data-scroll") * (it ? it.offsetWidth : 364), behavior: "smooth" });
    }
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") { closeBio(); setNav(false); } });
  $$("[data-bio]").forEach(function (el) {
    el.setAttribute("tabindex", "0");
    el.setAttribute("role", "button");
    el.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openBio(+el.getAttribute("data-bio")); }
    });
  });
  // leaving the page through the browser's back/forward cache must not keep the menu open
  window.addEventListener("pageshow", function () { setNav(false); });



  /* ---------- smooth scroll for links to a section of the current page ---------- */
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.addEventListener("click", function (e) {
    var a = e.target.closest ? e.target.closest("a[href*='#']") : null;
    if (!a || !a.hash || a.hash === "#" || a.pathname !== location.pathname || e.defaultPrevented) return;
    var el = document.getElementById(decodeURIComponent(a.hash.slice(1)));
    if (!el) return;
    e.preventDefault();
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    history.pushState(null, "", a.hash);
  });

  /* ---------- testimonials: automatic scrolling (pauses on hover/touch and when off-screen) ---------- */
  $$(".pa-track").forEach(function (track) {
    if (reduce || track.children.length < 2) return;
    var paused = false, visible = false, resume = 0;
    function step() {
      if (paused || !visible || document.hidden) return;
      var it = track.firstElementChild, w = it ? it.offsetWidth : 300;
      if (track.scrollLeft >= track.scrollWidth - track.clientWidth - 4) track.scrollTo({ left: 0, behavior: "smooth" });
      else track.scrollBy({ left: w, behavior: "smooth" });
    }
    function hold(ms) { paused = true; clearTimeout(resume); if (ms) resume = setTimeout(function () { paused = false; }, ms); }
    track.addEventListener("pointerenter", function (e) { if (e.pointerType === "mouse") hold(0); });
    track.addEventListener("pointerleave", function (e) { if (e.pointerType === "mouse") { clearTimeout(resume); paused = false; } });
    track.addEventListener("touchstart", function () { hold(6000); }, { passive: true });
    var sec = track.closest("section");
    if (sec) sec.addEventListener("click", function (e) { if (e.target.closest("[data-scroll]")) hold(6000); });
    if ("IntersectionObserver" in window) new IntersectionObserver(function (en) { visible = en[0].isIntersecting; }).observe(track);
    else visible = true;
    setInterval(step, 4200);
  });

  /* ---------- prefetch next page on hover/touch (Safari/Firefox; Chromium uses speculation rules) ---------- */
  var done = {};
  function prefetch(e) {
    var a = e.target.closest ? e.target.closest("a[href^='/']") : null;
    if (!a || a.hash && a.pathname === location.pathname) return;
    var href = a.pathname;
    if (done[href] || href.indexOf("/assets/") === 0) return;
    done[href] = 1;
    var l = document.createElement("link");
    l.rel = "prefetch"; l.href = href; l.as = "document";
    document.head.appendChild(l);
  }
  if (!(window.HTMLScriptElement && HTMLScriptElement.supports && HTMLScriptElement.supports("speculationrules"))) {
    document.addEventListener("pointerover", prefetch, { passive: true });
    document.addEventListener("touchstart", prefetch, { passive: true });
  }


  /* ---------- keep the menu button readable on any background (white pill once the page is scrolled) ---------- */
  var root = document.documentElement;
  var themeMeta = document.querySelector('meta[name="theme-color"]'), baseTheme = themeMeta ? themeMeta.getAttribute("content") : "";
  function onScroll() {
    var on = (window.pageYOffset || 0) > 40;
    root.classList.toggle("scrolled", on);
    if (themeMeta) themeMeta.setAttribute("content", on ? "#ffffff" : baseTheme);   // status-bar / browser chrome turns white with the bar
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();


  /* ---------- appointment calendar (rendez-vous page) ---------- */
  var cal = $("#rdv-cal");
  if (cal) (function () {
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var view = new Date(today.getFullYear(), today.getMonth(), 1), sel = null, hour = "";
    var HOURS = ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00", "17:00"];
    var DAYS = ["lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim."];
    var fmt = function (d, o) { return d.toLocaleDateString("fr-FR", o); };
    function draw() {
      var first = (view.getDay() + 6) % 7, n = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
      var h = '<div><div class="cal-h"><button type="button" data-m="-1" aria-label="Mois précédent"' +
        (view <= new Date(today.getFullYear(), today.getMonth(), 1) ? " disabled" : "") + '>‹</button><span>' +
        fmt(view, { month: "long", year: "numeric" }) + '</span><button type="button" data-m="1" aria-label="Mois suivant">›</button></div><div class="cal-g">';
      DAYS.forEach(function (d) { h += "<span>" + d + "</span>"; });
      for (var i = 0; i < first; i++) h += "<i></i>";
      for (var d = 1; d <= n; d++) {
        var dt = new Date(view.getFullYear(), view.getMonth(), d), wk = dt.getDay() % 6 === 0;
        var on = sel && +dt === +sel;
        h += '<button type="button" data-d="' + d + '"' + (dt < today || wk ? " disabled" : "") + (on ? ' class="sel" aria-pressed="true"' : "") + ">" + d + "</button>";
      }
      h += '</div></div><div class="cal-t">';
      if (sel) {
        h += "<b>" + esc(fmt(sel, { weekday: "long", day: "numeric", month: "long" })) + '</b><div class="cal-s">';
        HOURS.forEach(function (t) { h += '<button type="button" data-h="' + t + '"' + (t === hour ? ' class="sel"' : "") + ">" + t.replace(":", "h") + "</button>"; });
        h += "</div>";
      } else h += "<b>Horaires</b><p>Choisissez d’abord un jour disponible (du lundi au vendredi).</p>";
      cal.innerHTML = h + "</div>";
      $("#rdv-date").value = sel ? sel.getFullYear() + "-" + ("0" + (sel.getMonth() + 1)).slice(-2) + "-" + ("0" + sel.getDate()).slice(-2) : "";
      $("#rdv-heure").value = hour;
    }
    cal.addEventListener("click", function (e) {
      var b = e.target.closest("button");
      if (!b || b.disabled) return;
      if (b.hasAttribute("data-m")) view = new Date(view.getFullYear(), view.getMonth() + +b.getAttribute("data-m"), 1);
      else if (b.hasAttribute("data-d")) { sel = new Date(view.getFullYear(), view.getMonth(), +b.getAttribute("data-d")); hour = ""; }
      else if (b.hasAttribute("data-h")) hour = b.getAttribute("data-h");
      draw();
    });
    draw();
  })();

  /* ---------- cookie notice ---------- */
  var accept = function () {
    document.documentElement.setAttribute("data-ck", "1");
    try { localStorage.setItem("pa-cookie", "1"); } catch (e) {}
  };
  var ok = $("#cookie-ok"), x = $("#cookie-x");
  if (ok) ok.addEventListener("click", accept);
  if (x) x.addEventListener("click", accept);
})();
