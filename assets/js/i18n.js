/* Multilingual runtime: en, de, fr, fi, sv, it.
   Every language is a real, already translated page (French at the root, /en/ /de/ /fi/ /sv/ /it/ for the others),
   so this file does not translate anything.  It only
     - exposes window.PA_I18N (current language, the few texts used by JavaScript, language-aware links),
     - drives the language selector (the options are plain links; the choice is remembered in localStorage "pa-lang"),
     - keeps long translated words inside their box (titles shrink just enough).
   The language of a visitor arriving on the root is decided by the tiny script in <head>:
   saved choice > browser language (navigator.languages / navigator.language) > English. */
(function () {
  "use strict";
  var root = document.documentElement;
  var lang = root.lang || "fr";
  var UI = window.PA_UI || {};

  window.PA_I18N = {
    lang: function () { return lang; },
    t: function (id, fallback) { return UI[id] != null ? UI[id] : fallback; },
    href: function (path) { return lang === "fr" ? path : "/" + lang + (path === "/" ? "/" : path); }
  };

  /* ---------- language selector ---------- */
  function closeAll() {
    var o = document.querySelectorAll(".langsw.open");
    for (var i = 0; i < o.length; i++) {
      o[i].classList.remove("open");
      var b = o[i].querySelector(".lang-cur");
      if (b) b.setAttribute("aria-expanded", "false");
    }
  }
  document.addEventListener("click", function (e) {
    var opt = e.target.closest ? e.target.closest(".langsw a[data-lang]") : null;
    if (opt) {      // manual choice: remember it, then let the link navigate to the other language
      try { localStorage.setItem("pa-lang", opt.getAttribute("data-lang")); } catch (x) {}
      return;
    }
    var cur = e.target.closest ? e.target.closest(".lang-cur") : null;
    if (cur) {
      var box = cur.parentNode, open = !box.classList.contains("open");
      closeAll();
      box.classList.toggle("open", open);
      cur.setAttribute("aria-expanded", open ? "true" : "false");
      return;
    }
    closeAll();
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeAll(); });

  /* ---------- keep long translated words inside their box (titles shrink just enough, never overflow) ---------- */
  var FIT = ["h1", "h2", "h3", "h4", ".ph1", ".ph2"];
  var fitTimer = 0;
  function fitAll() {
    var sel = [];
    FIT.forEach(function (f) { sel.push("main " + f); });
    sel.push("footer h2", "footer h3", "footer h4");
    var list = document.querySelectorAll(sel.join(","));
    for (var i = 0; i < list.length; i++) {
      var el = list[i];
      if (el._fit === undefined) el._fit = [el.style.getPropertyValue("font-size"), el.style.getPropertyPriority("font-size")];
      if (el._fit[0]) el.style.setProperty("font-size", el._fit[0], el._fit[1]); else el.style.removeProperty("font-size");
      if (!el.clientWidth) continue;
      var size = parseFloat(getComputedStyle(el).fontSize), min = size * 0.55;
      el.style.setProperty("overflow-wrap", "normal", "important");   // measure the longest word, not the broken one
      while (el.scrollWidth > el.clientWidth && size > min) {
        size -= 0.5;
        el.style.setProperty("font-size", size + "px", "important");
      }
      el.style.removeProperty("overflow-wrap");
    }
  }
  function fitSoon() { clearTimeout(fitTimer); fitTimer = setTimeout(fitAll, 120); }
  fitAll();
  window.addEventListener("resize", fitSoon);
  window.addEventListener("orientationchange", fitSoon);
  window.addEventListener("load", fitSoon);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitSoon);
})();
