(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var tr = function (id, fb) { return window.PA_I18N ? window.PA_I18N.t(id, fb) : fb; };
  var curLang = function () { return window.PA_I18N ? window.PA_I18N.lang() : "fr"; };
  var esc = function (s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); };

  /* ---------- mobile side menu ---------- */
  function setNav(open) {
    var nav = $("#mobnav"), b = $("#burger");
    if (nav) {
      clearTimeout(nav._reset);
      if (open) {
        /* iPhone Safari paints the page under its bottom toolbar, but clips fixed elements to the area above it.
           While the menu is open (page scroll locked) the layer is therefore an absolute block that starts at the top
           of the screen and runs 400px below it: dark layer and white panel reach the very bottom of the screen. */
        nav.style.position = "absolute";
        nav.style.top = (window.pageYOffset || 0) + "px";
        nav.style.bottom = "auto";
        nav.style.height = (window.innerHeight + 400) + "px";
      } else {
        nav._reset = setTimeout(function () {
          nav.style.position = nav.style.top = nav.style.bottom = nav.style.height = "";
        }, 450);
      }
      nav.classList.toggle("open", open);
    }
    if (b) b.setAttribute("aria-expanded", open ? "true" : "false");
    document.body.style.overflow = open ? "hidden" : "";
    if (!open) {
      var s = $("#msubs"), pl = $(".msub");
      if (s) s.classList.remove("open");
      if (pl) { pl.textContent = "+"; pl.setAttribute("aria-expanded", "false"); }
    }
  }

  /* ---------- team biography dialog (cabinet page) ---------- */
  var bioClosing = false;
  function closeBio() {
    var r = $("#bio-root"), bg = $("#bio-bg");
    if (!r || !r.innerHTML || bioClosing) return;
    bioClosing = true;
    var done = function () { r.innerHTML = ""; document.body.style.overflow = ""; document.body.style.paddingRight = ""; bioClosing = false; };
    if (bg) { bg.style.opacity = "0"; setTimeout(done, 260); } else done();
  }
  function openBio(i) {
    var b = (window.PA_BIOS || [])[i];
    if (!b) return;
    var h = "";
    b.blocks.forEach(function (x) {
      h += '<div><p style="margin:0">' + esc(x.text) + "</p>";
      if (x.hasItems) h += '<ul style="margin:8px 0 0;padding-left:22px;display:flex;flex-direction:column;gap:4px">' + x.items.map(function (t, k) { return "<li>" + esc(t) + "</li>"; }).join("") + "</ul>";
      h += "</div>";
    });
    $("#bio-root").innerHTML =
      '<div id="bio-bg" role="dialog" aria-modal="true" aria-label="' + esc(b.name) + '" style="position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:100;display:flex;align-items:center;justify-content:center;padding:24px;opacity:0;transition:opacity .25s ease">' +
      '<div style="background:#fff;border-radius:10px;max-width:880px;width:100%;max-height:90vh;overflow:auto;position:relative;display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:28px;padding:32px">' +
      '<button id="bio-x" aria-label="' + esc(tr("u.close", "Fermer")) + '" style="position:absolute;top:10px;right:14px;background:none;border:0;font-size:28px;color:#666;cursor:pointer;line-height:1">×</button>' +
      (b.photo ? '<img src="' + esc(b.photo) + '" alt="' + esc(b.name) + '" style="width:100%;border-radius:8px;object-fit:cover;background:#dde9ec;aspect-ratio:4/5">' : "") +
      '<div style="display:flex;flex-direction:column;gap:12px;font-size:15px"><h3 style="margin:0;font-size:24px;font-weight:700;color:#428c9e">' + esc(b.name) + "</h3>" + h +
      '<div><a href="' + (window.PA_I18N ? window.PA_I18N.href("/rendez-vous") : "/rendez-vous") + '" style="display:inline-block;margin-top:6px;background:#428c9e;color:#fff;border-radius:100px;padding:10px 26px;font-size:16px;font-weight:500;border:1px solid #428c9e">' + esc(b.cta) + "</a></div></div></div></div>";
    var sw = window.innerWidth - document.documentElement.clientWidth;      // keep the page from jumping when the scrollbar disappears
    document.body.style.overflow = "hidden";
    if (sw > 0) document.body.style.paddingRight = sw + "px";
    $("#bio-bg").addEventListener("click", function (e) { if (e.target === this) closeBio(); });
    $("#bio-x").addEventListener("click", closeBio);
    $("#bio-x").focus({ preventScroll: true });
    // the dialog is revealed (soft fade) only once its photo is decoded: it never opens on an empty box
    var photo = $("#bio-bg img"), shown = false;
    var show = function () {
      if (shown) return;
      shown = true;
      requestAnimationFrame(function () { var bg = $("#bio-bg"); if (bg) bg.style.opacity = "1"; });
    };
    if (photo && photo.decode) photo.decode().then(show, show); else show();
    setTimeout(show, 900);
  }

  /* biography photos are fetched once the page is idle, so the dialog never opens on an empty grey box */
  window.addEventListener("load", function () {
    setTimeout(function () { (window.PA_BIOS || []).forEach(function (b) { if (b.photo) { var i = new Image(); i.src = b.photo; } }); }, 400);
  });

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
    if (t.classList.contains("mclose")) { setNav(false); return; }
    if (t.tagName === "A" && t.closest("#mobpanel")) {
      // following a link: hide the menu at once (no fade) so the page change never shows a half-open menu
      var mn = $("#mobnav"), pn = $("#mobpanel");
      if (mn && pn) { mn.style.transition = "none"; pn.style.transition = "none"; }
      setNav(false);
      return;
    }
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
  window.addEventListener("pageshow", function () {
    var mn = $("#mobnav"), pn = $("#mobpanel");
    if (mn) mn.style.transition = ""; if (pn) pn.style.transition = "";
    setNav(false);
  });



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
    var fmt = function (d, o) { return d.toLocaleDateString(curLang(), o); };
    var days = function () { var r = []; for (var i = 1; i <= 7; i++) r.push(fmt(new Date(2024, 0, i), { weekday: "short" })); return r; };
    function draw() {
      var first = (view.getDay() + 6) % 7, n = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
      var h = '<div><div class="cal-h"><button type="button" data-m="-1" aria-label="' + esc(tr("u.prevmonth", "Mois précédent")) + '"' +
        (view <= new Date(today.getFullYear(), today.getMonth(), 1) ? " disabled" : "") + '>‹</button><span>' +
        fmt(view, { month: "long", year: "numeric" }) + '</span><button type="button" data-m="1" aria-label="' + esc(tr("u.nextmonth", "Mois suivant")) + '">›</button></div><div class="cal-g">';
      days().forEach(function (d) { h += "<span>" + esc(d) + "</span>"; });
      for (var i = 0; i < first; i++) h += "<i></i>";
      for (var d = 1; d <= n; d++) {
        var dt = new Date(view.getFullYear(), view.getMonth(), d), wk = dt.getDay() % 6 === 0;
        var on = sel && +dt === +sel;
        h += '<button type="button" data-d="' + d + '"' + (dt < today || wk ? " disabled" : "") + (on ? ' class="sel" aria-pressed="true"' : "") + ">" + d + "</button>";
      }
      h += '</div></div><div class="cal-t">';
      if (sel) {
        h += "<b>" + esc(fmt(sel, { weekday: "long", day: "numeric", month: "long" })) + '</b><div class="cal-s">';
        HOURS.forEach(function (t) { h += '<button type="button" data-h="' + t + '"' + (t === hour ? ' class="sel"' : "") + ">" + (curLang() === "fr" ? t.replace(":", "h") : t) + "</button>"; });
        h += "</div>";
      } else h += "<b>" + esc(tr("u.times", "Horaires")) + "</b><p>" + esc(tr("u.pickday", "Choisissez d’abord un jour disponible (du lundi au vendredi).")) + "</p>";
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


  /* ---------- once the page is loaded, fetch the remaining lazy images in the background so they are already there when scrolled to ---------- */
  function warm() { $$("img[loading='lazy']").forEach(function (i) { i.loading = "eager"; }); }
  if (document.readyState === "complete") setTimeout(warm, 300);
  else window.addEventListener("load", function () { setTimeout(warm, 300); });

  /* ---------- page change: the next page is fetched and its pictures decoded BEFORE it opens ----------
     The current page stays untouched until everything is ready, so the new page appears complete:
     no flash, no blink, no photo popping in. */
  (function () {
    var ready = {}, going = false;
    function prepare(u) {
      var key = u.pathname + u.search;
      if (ready[key]) return ready[key];
      ready[key] = fetch(u.href, { credentials: "same-origin" }).then(function (r) { return r.ok ? r.text() : ""; }).then(function (html) {
        if (!html) return;
        var re = /\/assets\/img\/[A-Za-z0-9_.\-]+\.(?:webp|png|jpg)(?:\?v=[a-f0-9]+)?/g, m, seen = {}, urls = [];
        while ((m = re.exec(html)) && urls.length < 14) {
          if (!seen[m[0]] && !/favicon|logo/.test(m[0])) { seen[m[0]] = 1; urls.push(m[0]); }
        }
        return Promise.all(urls.map(function (src) {
          return new Promise(function (res) {
            var i = new Image();
            i.src = src;
            (i.decode ? i.decode() : Promise.resolve()).then(res, res);
          });
        }));
      }).catch(function () {});
      return ready[key];
    }
    function target(a, e) {
      if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download") || a.hasAttribute("data-bio")) return null;
      if (e && (e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)) return null;
      var u;
      try { u = new URL(a.href, location.href); } catch (x) { return null; }
      if (u.origin !== location.origin || /^\/(assets|locales)\//.test(u.pathname)) return null;
      if (u.pathname === location.pathname && u.search === location.search) return null;   // same page (#section)
      return u;
    }
    function warm(e) {
      var u = target(e.target.closest ? e.target.closest("a[href]") : null, null);
      if (u) prepare(u);
    }
    document.addEventListener("pointerover", function (e) { if (e.pointerType === "mouse") warm(e); }, { passive: true });
    document.addEventListener("touchstart", warm, { passive: true });
    document.addEventListener("click", function (e) {
      if (e.defaultPrevented || going) return;
      var u = target(e.target.closest ? e.target.closest("a[href]") : null, e);
      if (!u) return;
      e.preventDefault();
      going = true;
      var root = document.documentElement;
      root.classList.add("leaving");
      var bar = setTimeout(function () { root.classList.add("slow"); }, 700);
      Promise.race([prepare(u), new Promise(function (r) { setTimeout(r, 3500); })]).then(function () {
        clearTimeout(bar);
        location.assign(u.href);
      });
    });
    window.addEventListener("pageshow", function () {
      going = false;
      document.documentElement.classList.remove("leaving", "slow");
    });
  })();
})();
