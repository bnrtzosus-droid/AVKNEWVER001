/* i18n tests - run with:  node tests/i18n.test.js
   Starts tools/serve.py itself (port 8110) and drives Chromium through Playwright.
   Site layout: French at the root, /en/ /de/ /fi/ /sv/ /it/ for the other languages (one static page per language). */
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const PORT = 8110;
const BASE = 'http://localhost:' + PORT;
const LANGS = ['en', 'de', 'fr', 'fi', 'sv', 'it'];
const FR = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/i18n/fr.json'), 'utf8'));
const NAV = { en: 'Our firm', de: 'Unsere Kanzlei', fr: 'Notre cabinet', fi: 'Toimistomme', sv: 'Vår byrå', it: 'Il nostro studio' };
const OG = { fr: 'fr_FR', en: 'en_GB', de: 'de_DE', fi: 'fi_FI', sv: 'sv_SE', it: 'it_IT' };
const PAGES = ['/', '/cabinet', '/droit-de-la-famille', '/actualites', '/enjeux-droit-famille-patrimoine', '/rendez-vous', '/politique-de-confidentialite', '/cgu'];
const url = (l, p) => (l === 'fr' ? p : '/' + l + (p === '/' ? '/' : p));
const locale = (l) => JSON.parse(fs.readFileSync(path.join(ROOT, 'locales', l, 'translation.json'), 'utf8')).strings;

let passed = 0, failed = 0;
function ok(cond, name, extra) {
  if (cond) { passed++; console.log('  ok   ' + name); }
  else { failed++; console.log('  FAIL ' + name + (extra ? '  -> ' + extra : '')); }
}

async function ctx(browser, opts) {
  const c = await browser.newContext(Object.assign({ viewport: { width: 1280, height: 900 } }, opts));
  await c.addInitScript(() => { try { localStorage.setItem('pa-cookie', '1'); } catch (e) {} });
  return c;
}
const navText = (p) => p.locator('#topfix a[data-nav="cabinet"]').first().innerText();
const lang = (p) => p.evaluate(() => document.documentElement.lang);
const where = (p) => new URL(p.url()).pathname;

(async () => {
  const srv = spawn('python3', [path.join(ROOT, 'tools/serve.py'), String(PORT)], { stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 1200));
  const browser = await chromium.launch();
  try {
    console.log('\n1. Automatic detection on arrival (navigator.languages / navigator.language)');
    for (const [loc, want] of [['en-US', 'en'], ['de-DE', 'de'], ['fr-FR', 'fr'], ['fi-FI', 'fi'], ['sv-SE', 'sv'], ['it-IT', 'it'], ['it', 'it'], ['de', 'de'], ['fr', 'fr'], ['es-ES', 'en'], ['ja-JP', 'en'], ['pt-BR', 'en']]) {
      const c = await ctx(browser, { locale: loc });
      const p = await c.newPage();
      await p.goto(BASE + '/');
      const l = await lang(p), t = await navText(p);
      ok(l === want && where(p) === url(want, '/') && t === NAV[want], 'browser ' + loc + ' -> ' + want + ' (' + where(p) + ')', 'got ' + l + ' ' + where(p) + ' ' + t);
      await c.close();
    }
    {
      const c = await ctx(browser, { locale: 'es-ES' });
      await c.addInitScript(() => { Object.defineProperty(navigator, 'languages', { get: () => ['es-ES', 'sv-FI', 'it-IT'] }); });
      const p = await c.newPage();
      await p.goto(BASE + '/cabinet');
      ok((await lang(p)) === 'sv' && where(p) === '/sv/cabinet', 'navigator.languages [es-ES, sv-FI, it-IT] -> first supported (sv), same page kept: ' + where(p));
      await c.close();
    }

    console.log('\n2. Priority: saved choice > browser language > English');
    {
      const c = await ctx(browser, { locale: 'de-DE' });
      await c.addInitScript(() => { try { localStorage.setItem('pa-lang', 'fi'); } catch (e) {} });
      const p = await c.newPage();
      await p.goto(BASE + '/');
      ok((await lang(p)) === 'fi' && where(p) === '/fi/', 'saved "fi" beats browser "de-DE"');
      await c.close();
    }
    {
      const c = await ctx(browser, { locale: 'de-DE' });
      await c.addInitScript(() => { try { localStorage.setItem('pa-lang', 'fr'); } catch (e) {} });
      const p = await c.newPage();
      await p.goto(BASE + '/');
      ok((await lang(p)) === 'fr' && where(p) === '/', 'saved "fr" keeps the French root even with a German browser');
      await c.close();
    }
    {
      const c = await ctx(browser, { locale: 'de-DE' });
      await c.addInitScript(() => { try { localStorage.setItem('pa-lang', 'xx'); } catch (e) {} });
      const p = await c.newPage();
      await p.goto(BASE + '/');
      ok((await lang(p)) === 'de', 'invalid saved value is ignored -> browser language');
      await c.close();
    }
    {
      const c = await ctx(browser, { locale: 'de-DE' });
      const p = await c.newPage();
      await p.goto(BASE + '/it/cabinet');
      ok((await lang(p)) === 'it' && where(p) === '/it/cabinet', 'an explicit language URL (/it/cabinet) is never redirected');
      await c.close();
    }

    console.log('\n3. Italian browser');
    for (const loc of ['it', 'it-IT']) {
      const c = await ctx(browser, { locale: loc });
      const p = await c.newPage();
      await p.goto(BASE + '/');
      const h = await p.locator('h2.ph2').first().innerText();
      ok((await lang(p)) === 'it' && where(p) === '/it/' && /Studio legale/.test(h) && (await p.title()).includes('Studio legale'), 'navigator "' + loc + '" -> site directly in Italian (/it/)', h);
      await c.close();
    }

    console.log('\n4. Manual selection is kept after refresh and on return');
    {
      const c = await ctx(browser, { locale: 'en-US' });
      const p = await c.newPage();
      await p.goto(BASE + '/en/');
      ok((await lang(p)) === 'en', 'starts in English');
      await p.locator('.langsw.desk .lang-cur').click();
      const opts = await p.locator('.langsw.desk [data-lang]').evaluateAll((l) => l.map((x) => x.getAttribute('data-lang')));
      ok(JSON.stringify(opts) === JSON.stringify(LANGS), 'selector lists exactly the six languages: ' + opts.join(','));
      const flags = await p.locator('.langsw.desk [data-lang] img.flag').evaluateAll((l) => l.map((x) => x.complete && x.naturalWidth > 0));
      ok(flags.length === 6 && flags.every(Boolean), 'all six flags are displayed');
      await p.locator('.langsw.desk [data-lang="it"]').click();
      await p.waitForURL('**/it/');
      ok((await lang(p)) === 'it' && (await navText(p)) === NAV.it, 'choosing Italiano opens the Italian page (/it/)');
      ok((await p.evaluate(() => localStorage.getItem('pa-lang'))) === 'it', 'choice stored in localStorage');
      await p.reload();
      ok((await lang(p)) === 'it' && where(p) === '/it/', 'after refresh: still Italian');
      await p.goto(BASE + '/');
      ok((await lang(p)) === 'it' && where(p) === '/it/', 'back on the site (root): Italian restored');
      await p.goto(BASE + '/cabinet');
      ok(where(p) === '/it/cabinet', 'any French URL is sent to the Italian page: ' + where(p));
      // switch the language on an inner page: same page, other language
      await p.locator('.langsw.desk .lang-cur').click();
      await p.locator('.langsw.desk [data-lang="de"]').click();
      await p.waitForURL('**/de/cabinet');
      ok((await lang(p)) === 'de' && (await navText(p)) === NAV.de, 'inner page: Cabinet stays Cabinet in German (/de/cabinet)');
      await c.close();
    }


    console.log('\n4b. ?lang=xx links open the matching language page');
    for (const [from, want] of [['/?lang=it', '/it/'], ['/cabinet?lang=de', '/de/cabinet'], ['/it/cabinet?lang=fr', '/cabinet'], ['/de/?lang=sv', '/sv/'], ['/cabinet?lang=fi&x=1', '/fi/cabinet?x=1'], ['/?lang=zz', '/en/?lang=zz']]) {
      const c = await ctx(browser, { locale: 'en-US' });
      const p = await c.newPage();
      await p.goto(BASE + from);
      const got = new URL(p.url()).pathname + new URL(p.url()).search;
      ok(got === want, from + ' -> ' + want, got);
      await c.close();
    }
    console.log('\n5. Returning visitor: Italian with no flash of another language');
    {
      const c = await ctx(browser, { locale: 'en-US' });
      const p = await c.newPage();
      await p.goto(BASE + '/it/');
      await p.evaluate(() => localStorage.setItem('pa-lang', 'it'));   // what a click on the selector does
      await p.close();
      const q = await c.newPage();     // new tab = the saved choice is read from localStorage
      await q.addInitScript(() => {
        const log = JSON.parse(sessionStorage.getItem('frames') || '[]');
        const grab = () => {
          if (document.body && document.body.getBoundingClientRect().height > 0) {
            const h = document.querySelector('#topfix a[data-nav="cabinet"]');
            log.push({ lang: document.documentElement.lang, nav: h ? h.textContent : null });
            try { sessionStorage.setItem('frames', JSON.stringify(log)); } catch (e) {}
          }
          requestAnimationFrame(grab);
        };
        requestAnimationFrame(grab);
      });
      await q.goto(BASE + '/');
      await q.waitForTimeout(500);
      const seen = JSON.parse(await q.evaluate(() => sessionStorage.getItem('frames') || '[]'));
      const wrong = seen.filter((s) => s.lang !== 'it' || (s.nav && s.nav !== NAV.it));
      ok(where(q) === '/it/' && seen.length > 0 && wrong.length === 0, 'every painted frame is Italian (' + seen.length + ' frames)', JSON.stringify(wrong[0]));
      await c.close();
    }

    console.log('\n6. SEO tags: lang, canonical, hreflang, og:locale');
    {
      const c = await ctx(browser, { locale: 'en-US' });
      await c.addInitScript(() => { try { localStorage.setItem('pa-lang', 'fr'); } catch (e) {} });   // so that the French root is not redirected
      const p = await c.newPage();
      for (const l of LANGS) {
        for (const pg of ['/', '/cabinet', '/rendez-vous']) {
          await p.goto(BASE + url(l, pg));
          const m = await p.evaluate(() => ({
            lang: document.documentElement.lang,
            canonical: (document.querySelector('link[rel=canonical]') || {}).href,
            alt: [...document.querySelectorAll('link[rel=alternate][hreflang]')].map((x) => x.getAttribute('hreflang') + '=' + new URL(x.href).pathname),
            og: (document.querySelector('meta[property="og:locale"]') || {}).content,
            ogAlt: [...document.querySelectorAll('meta[property="og:locale:alternate"]')].length,
          }));
          const want = LANGS.map((x) => x + '=' + url(x, pg)).concat('x-default=' + url('en', pg));
          ok(m.lang === l && new URL(m.canonical).pathname === url(l, pg) && JSON.stringify(m.alt) === JSON.stringify(want) && m.og === OG[l] && m.ogAlt === 5,
            l + ' ' + pg + ': lang, canonical, 6 hreflang + x-default, og:locale ' + m.og, JSON.stringify(m));
        }
      }
      const sm = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
      ok((sm.match(/<url>/g) || []).length === 48 && (sm.match(/hreflang="x-default"/g) || []).length === 48, 'sitemap.xml: 8 pages x 6 languages, each with its alternates');
      await c.close();
    }

    console.log('\n7. Every language, every page: fully translated, links keep the language, no errors');
    for (const l of LANGS) {
      const c = await ctx(browser, { locale: l });
      const errors = [];
      const loc = locale(l);
      for (const pg of PAGES) {
        const p = await c.newPage();
        p.on('pageerror', (e) => errors.push(pg + ' ' + e.message));
        p.on('requestfailed', (r) => { if (!/google\.com/.test(r.url())) errors.push(pg + ' failed ' + r.url()); });
        await p.goto(BASE + url(l, pg));
        const bad = await p.evaluate(({ l, loc, fr }) => {
          const out = [];
          const txt = (h) => { const d = document.createElement('div'); d.innerHTML = h; return d.textContent.replace(/\s+/g, ' ').trim(); };
          const body = document.body.innerText.replace(/\s+/g, ' ');
          if (document.querySelector('[data-i18n],[data-i18n-attr]')) out.push('leftover data-i18n attributes');
          if (l !== 'fr') {
            Object.keys(loc).forEach((id) => {
              if (id[0] !== 'h' || loc[id] === fr[id]) return;
              const f = txt(fr[id]);
              if (f.split(' ').length >= 4 && body.includes(f)) out.push('French text left: ' + f.slice(0, 40));
            });
            document.querySelectorAll('a[href^="/"]').forEach((a) => {
              const h = a.getAttribute('href');
              if (/^\/(assets|locales)\//.test(h) || a.hasAttribute('data-lang')) return;
              if (!(h === '/' + l + '/' || h.startsWith('/' + l + '/'))) out.push('link without /' + l + ': ' + h);
            });
          }
          return out;
        }, { l, loc, fr: FR });
        ok(bad.length === 0, l + ' ' + pg + ': ' + (bad.length ? bad.slice(0, 3).join(' | ') : 'translated, links keep /' + l + '/'));
        await p.close();
      }
      ok(errors.length === 0, l + ': no JavaScript error / failed request', errors.slice(0, 2).join(' | '));
      await c.close();
    }

    console.log('\n8. Dynamic parts follow the language (calendar, biography dialog, 404)');
    {
      const c = await ctx(browser, { locale: 'en-US' });
      const p = await c.newPage();
      await p.goto(BASE + '/it/rendez-vous');
      const month = await p.locator('.cal-h span').innerText();
      ok(/(novembre|dicembre|gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre)/i.test(month), 'calendar month in Italian: ' + month);
      ok(/Scegli prima un giorno/.test(await p.locator('.cal-t p').innerText()), 'calendar hint translated');
      await p.goto(BASE + '/de/rendez-vous');
      ok(/(Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)/.test(await p.locator('.cal-h span').innerText()), 'calendar in German');
      ok((await p.title()).startsWith('Termin'), 'document title translated: ' + (await p.title()));
      await p.goto(BASE + '/de/cabinet');
      await p.locator('[data-bio="1"]').first().click();
      const dlg = await p.locator('#bio-bg').innerText();
      ok(/Master II Juristische und gerichtliche Praxis/.test(dlg) && /Termin mit RA GIANGRANDE/.test(dlg), 'biography dialog in German');
      ok((await p.locator('#bio-bg a[href*="rendez-vous"]').getAttribute('href')) === '/de/rendez-vous', 'biography button links to /de/rendez-vous');
      await p.goto(BASE + '/fi/ei-olemassa');
      ok((await lang(p)) === 'en' && /cannot be found/.test(await p.locator('main p').first().innerText()), '404 page shown in the visitor language (browser en-US): ' + where(p));
      await c.close();
    }

    console.log('\n9. Mobile: language list inside the menu');
    {
      const c = await ctx(browser, { locale: 'en-US', viewport: { width: 402, height: 874 }, isMobile: true, hasTouch: true });
      const p = await c.newPage();
      await p.goto(BASE + '/en/');
      await p.locator('#burger').click();
      await p.waitForTimeout(500);
      const vis = await p.locator('.langsw.mob [data-lang]').evaluateAll((l) => l.filter((x) => x.getBoundingClientRect().width > 0).length);
      ok(vis === 6, 'six languages visible in the mobile menu');
      await p.locator('.langsw.mob [data-lang="sv"]').click();
      await p.waitForURL('**/sv/');
      ok((await lang(p)) === 'sv' && (await p.evaluate(() => localStorage.getItem('pa-lang'))) === 'sv', 'Swedish chosen from the mobile menu: /sv/, choice stored');
      await c.close();
    }

    console.log('\n10. Layout: no overflow, no broken words in titles/buttons (6 languages x 8 pages x 5 widths)');
    for (const l of LANGS) {
      const c = await ctx(browser, { locale: l });
      const issues = [];
      for (const w of [360, 402, 768, 1024, 1440]) {
        const p = await c.newPage();
        await p.setViewportSize({ width: w, height: 900 });
        for (const pg of PAGES) {
          await p.goto(BASE + url(l, pg));
          await p.waitForTimeout(100);
          const r = await p.evaluate(() => {
            const out = [], vw = document.documentElement.clientWidth;
            if (document.documentElement.scrollWidth > vw + 1) out.push('page overflows ' + document.documentElement.scrollWidth + '>' + vw);
            document.querySelectorAll('main h1,main h2,main h3,main h4,main a.h1,main a.h4,main button').forEach((el) => {
              if (!el.clientWidth || el.closest('.cal') || getComputedStyle(el).display === 'none') return;
              el.style.setProperty('overflow-wrap', 'normal', 'important');
              if (/^H[1-4]$/.test(el.tagName)) {
                const cnt = () => { const rg = document.createRange(); rg.selectNodeContents(el); const seen = new Set(); [...rg.getClientRects()].forEach((q) => { if (q.width > 0) seen.add(Math.round(q.top)); }); return seen.size; };
                const n1 = cnt(); el.style.setProperty('overflow-wrap', 'break-word', 'important'); const n2 = cnt();
                if (n2 > n1 || el.scrollWidth > el.clientWidth) out.push('broken word in "' + el.textContent.trim().slice(0, 30) + '"');
              } else if (el.scrollWidth > el.clientWidth + 1) out.push('broken word in "' + el.textContent.trim().slice(0, 30) + '"');
              el.style.removeProperty('overflow-wrap');
            });
            document.querySelectorAll('main .cards, main .cards > *').forEach((el) => { if (el.scrollWidth > el.clientWidth + 1) out.push('cards overflow'); });
            return out;
          });
          r.forEach((x) => issues.push(w + ' ' + pg + ' ' + x));
        }
        await p.close();
      }
      ok(issues.length === 0, l + ': layout intact at 360 / 402 / 768 / 1024 / 1440 px', issues.slice(0, 3).join(' | '));
      await c.close();
    }
  } catch (e) {
    failed++;
    console.log('  FAIL unexpected error: ' + e.message);
  } finally {
    await browser.close();
    srv.kill();
  }
  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
})();
