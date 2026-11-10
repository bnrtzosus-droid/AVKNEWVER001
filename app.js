(function () {
  "use strict";
  var BIOS = window.PA_BIOS || [];
  var ROUTES = { cabinet: "cabinet", famille: "famille", actualites: "actualites", rdv: "rdv", article: "article", confidentialite: "conf", cgu: "cgu" };
  var TITLES = { home: "Accueil", cabinet: "Notre cabinet", famille: "Droit de la famille", actualites: "Actualités", article: "Actualités", rdv: "Rendez-vous", conf: "Politique de confidentialité", cgu: "CGU" };
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var route = "home";
  var esc = function (s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); };

  function setNav(open) {
    var nav = $("#mobnav"), b = $("#burger");
    if (nav) nav.style.display = open ? "block" : "none";
    if (b) b.setAttribute("aria-expanded", open ? "true" : "false");
    document.body.style.overflow = open ? "hidden" : "";
    if (!open) { var s = $("#msubs"), pl = $(".msub"); if (s) s.style.display = "none"; if (pl) { pl.textContent = "+"; pl.setAttribute("aria-expanded", "false"); } }
  }

  function closeBio() { var r = $("#bio-root"); if (r) r.innerHTML = ""; document.body.style.overflow = ""; }

  function openBio(i) {
    var b = BIOS[i]; if (!b) return;
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
      '<div><a href="#/rdv" class="bio-cta" style="display:inline-block;margin-top:6px;background:#428c9e;color:#fff;border-radius:100px;padding:10px 26px;font-size:16px;font-weight:500;border:1px solid #428c9e">' + esc(b.cta) + "</a></div></div></div></div>";
    document.body.style.overflow = "hidden";
    $("#bio-bg").addEventListener("click", function (e) { if (e.target === this) closeBio(); });
    $("#bio-x").addEventListener("click", closeBio);
    $(".bio-cta").addEventListener("click", closeBio);
    $("#bio-x").focus();
  }

  function applyRoute() {
    var parts = (location.hash || "").replace(/^#\/?/, "").split("/");
    route = ROUTES[parts[0]] || "home";
    var sec = parts[1];
    document.documentElement.setAttribute("data-r", route);
    $$(".nl").forEach(function (a) {
      var k = a.getAttribute("data-nav");
      a.classList.toggle("active", k === route || (k === "actualites" && route === "article"));
    });
    document.title = (route === "home" ? "" : TITLES[route] + " – ") + "Pessia & Associés";
    setNav(false);
    closeBio();
    var el = sec && document.getElementById(sec);
    window.scrollTo(0, el ? el.getBoundingClientRect().top + window.scrollY - 110 : 0);
  }

  // Page change: cross-fade old -> new (no blank frame), thin progress bar as on the live site
  var first = true, tmr = 0;
  var calm = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function routeOf() { return ROUTES[(location.hash || "").replace(/^#\/?/, "").split("/")[0]] || "home"; }
  function bar(on) {
    var b = $("#ldbar"); if (!b) return;
    clearTimeout(tmr);
    if (on) { b.style.transition = "none"; b.style.opacity = "1"; b.style.width = "0"; void b.offsetWidth; b.style.transition = "width .3s ease"; b.style.width = "80%"; }
    else { b.style.transition = "width .12s ease"; b.style.width = "100%"; tmr = setTimeout(function () { b.style.transition = "opacity .25s ease"; b.style.opacity = "0"; }, 150); }
  }
  function applyHash() {
    if (first || calm) { first = false; applyRoute(); return; }
    if (routeOf() === route) { applyRoute(); return; }      // same page (anchor jump)
    bar(true);
    if (document.startViewTransition) {
      var vt = document.startViewTransition(function () { applyRoute(); });
      vt.finished.then(function () { bar(false); }, function () { bar(false); });
    } else { applyRoute(); bar(false); }
  }

  document.addEventListener("click", function (e) {
    var t = e.target.closest ? e.target.closest("[data-bio],[data-scroll],#burger,.mclose,.msub,#mobpanel a,#mobnav") : null;
    if (!t) return;
    if (t.id === "burger") { setNav(true); return; }
    if (t.classList.contains("msub")) {
      var s = $("#msubs"), open = s.style.display !== "flex";
      s.style.display = open ? "flex" : "none"; t.textContent = open ? "−" : "+"; t.setAttribute("aria-expanded", open ? "true" : "false");
      return;
    }
    if (t.id === "mobnav") { if (e.target === t) setNav(false); return; }
    if (t.classList.contains("mclose") || (t.tagName === "A" && t.closest("#mobpanel"))) { setNav(false); return; }
    if (t.hasAttribute("data-bio")) { openBio(+t.getAttribute("data-bio")); return; }
    var track = $('[data-route="' + route + '"] .pa-track');
    if (track) { var it = track.firstElementChild; track.scrollBy({ left: +t.getAttribute("data-scroll") * (it ? it.offsetWidth : 364), behavior: "smooth" }); }
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") { closeBio(); setNav(false); } });
  $$("[data-bio]").forEach(function (el) {
    el.setAttribute("tabindex", "0"); el.setAttribute("role", "button");
    el.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openBio(+el.getAttribute("data-bio")); } });
  });

  var okCk = function () { document.documentElement.setAttribute("data-ck", "1"); try { localStorage.setItem("pa-cookie", "1"); } catch (e) {} };
  $("#cookie-ok").addEventListener("click", okCk); $("#cookie-x").addEventListener("click", okCk);

  window.addEventListener("hashchange", applyHash);
  applyHash();

  (window.requestIdleCallback || function (f) { setTimeout(f, 800); })(function () {
    ["2024/07/Rectangle-2.png", "2024/07/Rectangle-25.png", "2024/07/Rectangle-47.png"].forEach(function (u) { new Image().src = "https://pessia-associes.fr/wp-content/uploads/" + u; });
  });
})();
