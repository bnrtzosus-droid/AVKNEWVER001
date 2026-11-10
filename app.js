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
    if (nav) { nav.style.display = open ? "flex" : "none"; nav.style.flexDirection = "column"; }
    if (b) { b.textContent = open ? "×" : "☰"; b.setAttribute("aria-expanded", open ? "true" : "false"); }
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

  function applyHash() {
    var parts = (location.hash || "").replace(/^#\/?/, "").split("/");
    route = ROUTES[parts[0]] || "home";
    var sec = parts[1];
    $$("[data-route]").forEach(function (el) { el.style.display = el.getAttribute("data-route") === route ? "block" : "none"; });
    $$(".nl").forEach(function (a) {
      var k = a.getAttribute("data-nav");
      a.classList.toggle("active", k === route || (k === "actualites" && route === "article"));
    });
    document.title = (route === "home" ? "" : TITLES[route] + " – ") + "Pessia & Associés";
    setNav(false);
    closeBio();
    setTimeout(function () {
      var el = sec && document.getElementById(sec);
      window.scrollTo(0, el ? el.getBoundingClientRect().top + window.scrollY - 110 : 0);
    }, 80);
  }

  document.addEventListener("click", function (e) {
    var t = e.target.closest ? e.target.closest("[data-bio],[data-scroll],#burger") : null;
    if (!t) return;
    if (t.id === "burger") { setNav($("#mobnav").style.display !== "flex"); return; }
    if (t.hasAttribute("data-bio")) { openBio(+t.getAttribute("data-bio")); return; }
    var track = $('[data-route="' + route + '"] .pa-track');
    if (track) track.scrollBy({ left: +t.getAttribute("data-scroll") * 364, behavior: "smooth" });
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeBio(); });
  $$("[data-bio]").forEach(function (el) {
    el.setAttribute("tabindex", "0"); el.setAttribute("role", "button");
    el.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openBio(+el.getAttribute("data-bio")); } });
  });

  var ck = $("#cookie"), seen = false;
  try { seen = localStorage.getItem("pa-cookie") === "1"; } catch (e) {}
  if (!seen) ck.style.display = "block";
  $("#cookie-ok").addEventListener("click", function () { ck.style.display = "none"; try { localStorage.setItem("pa-cookie", "1"); } catch (e) {} });

  window.addEventListener("hashchange", applyHash);
  applyHash();
})();
