/* Multilingual runtime: en, de, fr, fi, sv, it.
   Language = saved choice (localStorage "pa-lang") > browser language (navigator.languages) > English.
   The first decision is made by the inline script in <head> (so the page never flashes in the wrong language);
   this file applies locales/<lang>/translation.json and drives the language selector. */
(function () {
  "use strict";
  var SUP = ["en", "de", "fr", "fi", "sv", "it"];
  var NAME = { en: "English", de: "Deutsch", fr: "Français", fi: "Suomi", sv: "Svenska", it: "Italiano" };
  var FLAG = { en: "gb", de: "de", fr: "fr", fi: "fi", sv: "se", it: "it" };
  var root = document.documentElement;
  var lang = root.getAttribute("data-lang") || "en";
  var dict = {};
  var cache = {};

  function load(l) {
    if (l === "fr") return Promise.resolve({});
    if (cache[l]) return Promise.resolve(cache[l]);
    var first = (window.PA_P && l === window.PA_LANG) ? window.PA_P : null;
    var v = (window.PA_V && window.PA_V[l]) || "0";
    var p = first || fetch("/locales/" + l + "/translation.json?v=" + v).then(function (r) { return r.json(); });
    return p.then(function (j) {
      if (!j || !j.strings) throw new Error("no translation");
      cache[l] = j.strings;
      return j.strings;
    });
  }

  /* put the strings of one language (or the French originals when d is null) into the page */
  function apply(d) {
    var list = document.querySelectorAll("[data-i18n],[data-i18n-attr]");
    for (var n = 0; n < list.length; n++) {
      var el = list[n], o = el._fr;
      if (!o) {
        o = el._fr = { c: null, a: {} };
        if (el.hasAttribute("data-i18n")) o.c = /^t/.test(el.getAttribute("data-i18n")) ? el.textContent : el.innerHTML;
        (el.getAttribute("data-i18n-attr") || "").split(",").forEach(function (p) {
          var k = p.split(":")[0];
          if (k) o.a[k] = el.getAttribute(k);
        });
      }
      var id = el.getAttribute("data-i18n");
      if (id) {
        var v = d && d[id] != null ? d[id] : o.c;
        if (/^t/.test(id)) el.textContent = v; else el.innerHTML = v;
      }
      var at = el.getAttribute("data-i18n-attr");
      if (at) at.split(",").forEach(function (p) {
        var kv = p.split(":");
        if (!kv[0]) return;
        var t = d && d[kv[1]] != null ? d[kv[1]] : o.a[kv[0]];
        if (t != null) el.setAttribute(kv[0], t);
      });
    }
  }

  function syncSwitchers() {
    var sw = document.querySelectorAll(".langsw");
    for (var i = 0; i < sw.length; i++) {
      var cur = sw[i].querySelector(".lang-cur");
      if (cur) {
        cur.querySelector("img").src = "/assets/img/flags/" + FLAG[lang] + ".svg";
        cur.querySelector(".lc").textContent = lang.toUpperCase();
      }
      var opts = sw[i].querySelectorAll("[data-lang]");
      for (var j = 0; j < opts.length; j++) {
        var on = opts[j].getAttribute("data-lang") === lang;
        opts[j].setAttribute("aria-selected", on ? "true" : "false");
        opts[j].classList.toggle("on", on);
      }
    }
  }


  /* ---------- keep long translated words inside their box (titles shrink just enough, never overflow) ---------- */
  var FIT = "h1,h2,h3,h4,.ph1,.ph2";
  var fitTimer = 0;
  function fitAll() {
    var list = document.querySelectorAll("main " + FIT.split(",").join(",main ") + ",footer h2,footer h3,footer h4");
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
  window.addEventListener("resize", fitSoon);
  window.addEventListener("orientationchange", fitSoon);
  window.addEventListener("load", fitSoon);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitSoon);

  function done() {
    fitAll();
    root.classList.remove("i18n-wait");
    syncSwitchers();
    document.dispatchEvent(new CustomEvent("pa:lang", { detail: lang }));
  }

  function setLang(l, save) {
    if (SUP.indexOf(l) < 0) return Promise.resolve();
    return load(l).then(function (d) {
      lang = l; dict = d;
      root.lang = l; root.setAttribute("data-lang", l);
      if (save) { try { localStorage.setItem("pa-lang", l); } catch (e) {} }
      apply(l === "fr" ? null : d);
      done();
    }).catch(function () { /* keep the current language */ });
  }

  function closeAll() {
    var o = document.querySelectorAll(".langsw.open");
    for (var i = 0; i < o.length; i++) {
      o[i].classList.remove("open");
      var b = o[i].querySelector(".lang-cur");
      if (b) b.setAttribute("aria-expanded", "false");
    }
  }

  document.addEventListener("click", function (e) {
    var opt = e.target.closest ? e.target.closest(".langsw [data-lang]") : null;
    if (opt) { setLang(opt.getAttribute("data-lang"), true); closeAll(); return; }
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

  window.PA_I18N = {
    lang: function () { return lang; },
    t: function (id, fallback) { return dict && dict[id] != null ? dict[id] : fallback; },
    set: function (l) { return setLang(l, true); }
  };

  /* first paint: the page is hidden (html.i18n-wait) until the strings are applied */
  if (lang === "fr") { done(); }
  else {
    load(lang).then(function (d) { dict = d; apply(d); done(); })
      .catch(function () { done(); });
  }
})();
