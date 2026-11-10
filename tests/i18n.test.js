/* i18n tests - run with:  node tests/i18n.test.js
   Starts tools/serve.py itself (port 8110) and drives Chromium through Playwright. */
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
const PAGES = ['/', '/cabinet', '/droit-de-la-famille', '/actualites', '/enjeux-droit-famille-patrimoine', '/rendez-vous', '/politique-de-confidentialite', '/cgu'];

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

(async () => {
  const srv = spawn('python3', [path.join(ROOT, 'tools/serve.py'), String(PORT)], { stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 1200));
  const browser = await chromium.launch();
  try {
    console.log('\n1. Automatic detection (navigator.languages / navigator.language)');
    for (const [loc, want] of [['en-US', 'en'], ['de-DE', 'de'], ['fr-FR', 'fr'], ['fi-FI', 'fi'], ['sv-SE', 'sv'], ['it-IT', 'it'], ['it', 'it'], ['de', 'de'], ['es-ES', 'en'], ['ja-JP', 'en']]) {
      const c = await ctx(browser, { locale: loc });
      const p = await c.newPage();
      await p.goto(BASE + '/');
      await p.waitForFunction(() => !document.documentElement.classList.contains('i18n-wait'));
      const l = await lang(p), t = await navText(p);
      ok(l === want && t === NAV[want], 'browser ' + loc + ' -> ' + want, 'got ' + l + ' / ' + t);
      await c.close();
    }
    {
      // first supported language of the list wins; regional variants and unsupported first entries
      const c = await ctx(browser, { locale: 'es-ES' });
      await c.addInitScript(() => { Object.defineProperty(navigator, 'languages', { get: () => ['es-ES', 'sv-FI', 'it-IT'] }); });
      const p = await c.newPage();
      await p.goto(BASE + '/');
      ok((await lang(p)) === 'sv', 'navigator.languages [es-ES, sv-FI, it-IT] -> sv');
      await c.close();
    }

    console.log('\n2. Priority: saved preference > browser language > English');
    {
      const c = await ctx(browser, { locale: 'de-DE' });
      await c.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('pa-lang', 'fi'); sessionStorage.setItem('seeded', '1'); } });
      const p = await c.newPage();
      await p.goto(BASE + '/');
      await p.waitForFunction(() => !document.documentElement.classList.contains('i18n-wait'));
      ok((await lang(p)) === 'fi' && (await navText(p)) === NAV.fi, 'saved "fi" beats browser "de-DE"');
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
      const c = await ctx(browser, { locale: 'pt-BR' });
      const p = await c.newPage();
      await p.goto(BASE + '/');
      ok((await lang(p)) === 'en', 'unsupported browser language -> English');
      await c.close();
    }

    console.log('\n3. Italian browser');
    for (const loc of ['it', 'it-IT']) {
      const c = await ctx(browser, { locale: loc });
      const p = await c.newPage();
      await p.goto(BASE + '/');
      await p.waitForFunction(() => !document.documentElement.classList.contains('i18n-wait'));
      const h = await p.locator('h2.ph2').first().innerText();
      ok((await lang(p)) === 'it' && /Studio legale/.test(h) && (await p.title()).includes('Studio legale'), 'navigator "' + loc + '" -> site directly in Italian', h + ' | ' + (await p.title()));
      await c.close();
    }

    console.log('\n4. Manual selection persists after refresh');
    {
      const c = await ctx(browser, { locale: 'en-US' });
      const p = await c.newPage();
      await p.goto(BASE + '/');
      await p.waitForFunction(() => !document.documentElement.classList.contains('i18n-wait'));
      ok((await lang(p)) === 'en', 'starts in English (browser en-US)');
      await p.locator('.langsw.desk .lang-cur').click();
      const opts = await p.locator('.langsw.desk [data-lang]').evaluateAll((l) => l.map((x) => x.getAttribute('data-lang')));
      ok(JSON.stringify(opts) === JSON.stringify(LANGS), 'selector lists exactly the six languages: ' + opts.join(','));
      const flags = await p.locator('.langsw.desk [data-lang] img.flag').evaluateAll((l) => l.map((x) => x.complete && x.naturalWidth > 0));
      ok(flags.length === 6 && flags.every(Boolean), 'all six flags are displayed');
      await p.locator('.langsw.desk [data-lang="it"]').click();
      await p.waitForFunction(() => document.documentElement.lang === 'it');
      ok((await navText(p)) === NAV.it, 'switching to Italian translates the page without reload');
      ok((await p.evaluate(() => localStorage.getItem('pa-lang'))) === 'it', 'choice stored in localStorage');
      await p.reload();
      await p.waitForFunction(() => !document.documentElement.classList.contains('i18n-wait'));
      ok((await lang(p)) === 'it' && (await navText(p)) === NAV.it, 'after refresh: still Italian');
      await p.goto(BASE + '/cabinet');
      await p.waitForFunction(() => !document.documentElement.classList.contains('i18n-wait'));
      ok((await lang(p)) === 'it', 'another page: Italian');
      await c.close();
    }

    console.log('\n5. Coming back to the site: Italian restored with no language flash');
    {
      const c = await ctx(browser, { locale: 'en-US' });
      const p = await c.newPage();
      await p.goto(BASE + '/');
      await p.evaluate(() => localStorage.setItem('pa-lang', 'it'));
      await p.close();
      // new tab = returning visit; sample every frame, the text shown must never be French or English
      const q = await c.newPage();
      await q.addInitScript(() => {
        window.__seen = [];
        const grab = () => {
          const b = document.body;
          if (b) {
            const h = document.querySelector('#topfix a[data-nav="cabinet"]');
            window.__seen.push({ vis: getComputedStyle(b).visibility, lang: document.documentElement.lang, nav: h ? h.textContent : null });
          }
          requestAnimationFrame(grab);
        };
        requestAnimationFrame(grab);
      });
      await q.goto(BASE + '/');
      await q.waitForFunction(() => !document.documentElement.classList.contains('i18n-wait'));
      await q.waitForTimeout(300);
      const seen = await q.evaluate(() => window.__seen);
      const visibleWrong = seen.filter((s) => s.vis === 'visible' && s.nav && s.nav !== NAV.it);
      ok(seen.length > 0 && visibleWrong.length === 0, 'no visible frame in another language (' + seen.length + ' frames sampled)', JSON.stringify(visibleWrong[0]));
      ok(seen.every((s) => s.lang === 'it'), 'html lang is "it" in every frame');
      await c.close();
    }

    console.log('\n6. Every language, every page: fully translated, no errors');
    for (const l of LANGS) {
      const c = await ctx(browser, { locale: l });
      const errors = [];
      for (const pg of PAGES) {
        const p = await c.newPage();
        p.on('pageerror', (e) => errors.push(pg + ' ' + e.message));
        p.on('requestfailed', (r) => { if (!/google\.com/.test(r.url())) errors.push(pg + ' failed ' + r.url()); });
        await p.goto(BASE + pg);
        await p.waitForFunction(() => !document.documentElement.classList.contains('i18n-wait'));
        const loc = l === 'fr' ? FR : JSON.parse(fs.readFileSync(path.join(ROOT, 'locales', l, 'translation.json'), 'utf8')).strings;
        const bad = await p.evaluate(({ l, fr, loc }) => {
          const out = [];
          const txt = (h) => { const d = document.createElement('div'); d.innerHTML = h; return d.textContent.replace(/\s+/g, ' ').trim(); };
          document.querySelectorAll('[data-i18n]').forEach((el) => {
            const id = el.getAttribute('data-i18n');
            const want = txt(loc[id]);
            const cur = el.textContent.replace(/\s+/g, ' ').trim();
            if (cur !== want) out.push('not applied ' + id + ' [' + cur.slice(0, 30) + ']');
            if (l !== 'fr' && loc[id] === fr[id] && /[a-zà-ÿ]{4,}/.test(txt(fr[id])) && !/@|Piazza|Furlan|^[0-9. A-Za-z]+$/.test(txt(fr[id]))) out.push('same as French ' + id);
          });
          document.querySelectorAll('[data-i18n-attr]').forEach((el) => {
            el.getAttribute('data-i18n-attr').split(',').forEach((pr) => {
              const [a, id] = pr.split(':');
              if (el.getAttribute(a) !== loc[id]) out.push('attr ' + a + ' ' + id);
            });
          });
          return out;
        }, { l, fr: FR, loc });
        ok(bad.length === 0, l + ' ' + pg + ': ' + (bad.length ? bad.slice(0, 3).join(' | ') : 'all strings translated'));
        ok((await p.evaluate(() => document.documentElement.lang)) === l, l + ' ' + pg + ': <html lang>');
        await p.close();
      }
      ok(errors.length === 0, l + ': no JavaScript error / failed request', errors.slice(0, 2).join(' | '));
      await c.close();
    }

    console.log('\n7. Dynamic parts follow the language (calendar, biography dialog, title)');
    {
      const c = await ctx(browser, { locale: 'it-IT' });
      const p = await c.newPage();
      await p.goto(BASE + '/rendez-vous');
      await p.waitForFunction(() => !document.documentElement.classList.contains('i18n-wait'));
      const month = await p.locator('.cal-h span').innerText();
      ok(/(novembre|dicembre|gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre)/i.test(month), 'calendar month in Italian: ' + month);
      ok(/Scegli prima un giorno/.test(await p.locator('.cal-t p').innerText()), 'calendar hint translated');
      await p.locator('.langsw.desk .lang-cur').click();
      await p.locator('.langsw.desk [data-lang="de"]').click();
      await p.waitForFunction(() => document.documentElement.lang === 'de');
      ok(/(Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)/.test(await p.locator('.cal-h span').innerText()), 'calendar re-rendered in German');
      ok((await p.title()).startsWith('Termin'), 'document title translated: ' + (await p.title()));
      await p.goto(BASE + '/cabinet');
      await p.waitForFunction(() => !document.documentElement.classList.contains('i18n-wait'));
      await p.locator('[data-bio="1"]').first().click();
      const dlg = await p.locator('#bio-bg').innerText();
      ok(/Master II Juristische und gerichtliche Praxis/.test(dlg) && /Termin mit RA GIANGRANDE/.test(dlg), 'biography dialog in German');
      await c.close();
    }

    console.log('\n8. Mobile: language list inside the menu');
    {
      const c = await ctx(browser, { locale: 'en-US', viewport: { width: 402, height: 874 }, isMobile: true, hasTouch: true });
      const p = await c.newPage();
      await p.goto(BASE + '/');
      await p.waitForFunction(() => !document.documentElement.classList.contains('i18n-wait'));
      await p.locator('#burger').click();
      await p.waitForTimeout(500);
      const vis = await p.locator('.langsw.mob [data-lang]').evaluateAll((l) => l.filter((x) => x.getBoundingClientRect().width > 0).length);
      ok(vis === 6, 'six languages visible in the mobile menu');
      await p.locator('.langsw.mob [data-lang="sv"]').click();
      await p.waitForFunction(() => document.documentElement.lang === 'sv');
      ok((await p.evaluate(() => localStorage.getItem('pa-lang'))) === 'sv', 'Swedish chosen from the mobile menu and stored');
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
