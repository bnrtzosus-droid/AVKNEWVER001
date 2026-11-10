#!/usr/bin/env python3
"""Generate the static site (one real HTML file per page) from src/.

    python3 tools/build.py

Edit the partials/pages in src/, then re-run this script and commit the result.
Change BASE_URL below if the production domain is not pessia-associes.fr.
"""
import hashlib
import html
import json
import os
import re
import shutil

import i18n

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'src')
BASE_URL = 'https://pessia-associes.fr'
SITE = 'Furlan & Associés'
LOGO = '/assets/img/logo-512.png'

# key, output file, url path, <title>, meta description, active menu item, extra scripts
PAGES = [
    ('home', 'index.html', '/', 'Furlan & Associés – Cabinet d’avocats en droit de la famille à Milan',
     'Cabinet d’avocats en droit de la famille et des successions à Milan : divorce, successions, transmission de patrimoine, droit international.', 'home', []),
    ('cabinet', 'cabinet.html', '/cabinet', 'Notre cabinet – Furlan & Associés',
     'Découvrez le cabinet Furlan & Associés, son équipe d’avocats et ses valeurs : confiance, transparence et écoute.', 'cabinet', []),
    ('famille', 'droit-de-la-famille.html', '/droit-de-la-famille', 'Droit de la famille et des successions – Furlan & Associés',
     'Successions, fiscalité du divorce, divorce et succession transfrontaliers, transmission de patrimoine, droit international privé à Milan.', 'famille', []),
    ('actualites', 'actualites.html', '/actualites', 'Actualités – Furlan & Associés',
     'Les actualités du cabinet d’avocats Furlan & Associés en droit de la famille à Milan.', 'actualites', []),
    ('article', 'enjeux-droit-famille-patrimoine.html', '/enjeux-droit-famille-patrimoine',
     'Les enjeux du droit de la famille et du patrimoine : pourquoi faire appel à un avocat spécialisé ? – Furlan & Associés',
     'Divorce, succession, donation, gestion patrimoniale : pourquoi faire appel à un cabinet spécialisé en droit de la famille et du patrimoine.', 'actualites', []),
    ('rdv', 'rendez-vous.html', '/rendez-vous', 'Rendez-vous – Furlan & Associés',
     'Prenez directement rendez-vous avec un avocat en droit de la famille à Milan.', 'rdv', []),
    ('conf', 'politique-de-confidentialite.html', '/politique-de-confidentialite', 'Politique de confidentialité – Furlan & Associés',
     'Politique de confidentialité du site pessia-associes.fr.', None, []),
    ('cgu', 'cgu.html', '/cgu', 'Conditions générales d’utilisation – Furlan & Associés',
     'Conditions générales d’utilisation du site pessia-associes.fr.', None, []),
]


def ver(path):
    """Short content hash used as cache-busting query string."""
    with open(os.path.join(ROOT, path.lstrip('/')), 'rb') as f:
        return hashlib.md5(f.read()).hexdigest()[:8]


def bust(page):
    """Append a content hash to every local image URL so a replaced image is never served from a stale browser cache."""
    def one(m):
        path = m.group(1)
        return '%s?v=%s' % (path, ver(path)) if os.path.exists(os.path.join(ROOT, path.lstrip('/'))) else path
    return re.sub(r'(/assets/img/[A-Za-z0-9_.\-]+\.(?:webp|png|jpg|svg))(?![?\w])', one, page)


def lver(lang):
    """cache-busting version of a language = hash of its source file tools/i18n/<lang>.txt"""
    try:
        with open(os.path.join(ROOT, 'tools', 'i18n', lang + '.txt'), 'rb') as f:
            return hashlib.md5(f.read()).hexdigest()[:8]
    except OSError:
        return '0'


# runs in <head> before first paint: language = saved choice > browser language > English
LANG_BOOT = """(function(){var d=document.documentElement,S=["en","de","fr","fi","sv","it"],l,V=__V__;
try{l=localStorage.getItem("pa-lang")}catch(e){}
if(S.indexOf(l)<0){l=null;var n=navigator.languages&&navigator.languages.length?navigator.languages:[navigator.language||""];
for(var i=0;i<n.length&&!l;i++){var c=String(n[i]).toLowerCase().split(/[-_]/)[0];if(S.indexOf(c)>-1)l=c}}
if(!l)l="en";d.lang=l;d.setAttribute("data-lang",l);window.PA_LANG=l;window.PA_V=V;
if(l!=="fr"){d.classList.add("i18n-wait");window.PA_P=fetch("/locales/"+l+"/translation.json?v="+V[l]).then(function(r){return r.json()}).catch(function(){return null});
setTimeout(function(){d.classList.remove("i18n-wait")},3000)}})();"""


def write_bios():
    """assets/js/bios.js from src/bios.json, with an i18n id on every text."""
    with open(os.path.join(SRC, 'bios.json'), encoding='utf8') as f:
        data = json.load(f)
    for b in data:
        b['cid'] = i18n.plain(b['cta'])
        for blk in b['blocks']:
            blk['id'] = i18n.plain(blk['text'])
            blk['iids'] = [i18n.plain(t) for t in blk['items']]
    with open(os.path.join(ROOT, 'assets', 'js', 'bios.js'), 'w', encoding='utf8', newline='\n') as f:
        f.write('window.PA_BIOS=' + json.dumps(data, ensure_ascii=False) + ';\n')


def read(*p):
    with open(os.path.join(SRC, *p), encoding='utf8') as f:
        return f.read()


def write(path, text):
    with open(os.path.join(ROOT, path), 'w', encoding='utf8', newline='\n') as f:
        f.write(text)


E = lambda s: html.escape(s, quote=True)
header, footer, cookie = read('partials', 'header.html'), read('partials', 'footer.html'), read('partials', 'cookie.html')

LANG_NAMES = [('en', 'English', 'gb'), ('de', 'Deutsch', 'de'), ('fr', 'Français', 'fr'),
              ('fi', 'Suomi', 'fi'), ('sv', 'Svenska', 'se'), ('it', 'Italiano', 'it')]


def langsw(kind):
    """Language selector (dropdown in the top bar, plain list in the mobile menu)."""
    items = ''.join(
        '<li role="presentation"><button type="button" role="option" data-lang="%s" lang="%s"><img class="flag" src="/assets/img/flags/%s.svg" alt="" width="22" height="22"><span>%s</span></button></li>'
        % (c, c, f, n) for c, n, f in LANG_NAMES)
    return ('<div class="langsw %s" translate="no"><button type="button" class="lang-cur" aria-haspopup="listbox" aria-expanded="false" '
            'aria-label="Langue" data-i18n-attr="aria-label:u.lang"><img class="flag" src="/assets/img/flags/gb.svg" alt="" width="22" height="22">'
            '<span class="lc">EN</span><svg width="10" height="6" viewBox="0 0 10 6" aria-hidden="true"><path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.6"/></svg></button>'
            '<ul class="lang-list" role="listbox" aria-label="Langue" data-i18n-attr="aria-label:u.lang">%s</ul></div>' % (kind, items))


header, footer, cookie = i18n.tag(header, 'header'), i18n.tag(footer, 'footer'), i18n.tag(cookie, 'cookie')
header = header.replace('<!--LANGSW_DESK-->', langsw('desk')).replace('<!--LANGSW_MOB-->', langsw('mob'))


_dims = {}


def dims(src):
    """(width, height) of a local image, so the browser can reserve space before it loads."""
    if src not in _dims:
        _dims[src] = None
        path = os.path.join(ROOT, src.lstrip('/'))
        if src.endswith(('.webp', '.png', '.jpg')) and os.path.exists(path):
            try:
                from PIL import Image
                with Image.open(path) as im:
                    _dims[src] = im.size
            except ImportError:
                pass
    return _dims[src]


def lazy(s):
    def one(m):
        tag = m.group(0)
        if 'loading=' not in tag:
            tag = tag.replace('<img ', '<img loading="lazy" decoding="async" ', 1)
        src = re.search(r'src="([^"]+)"', tag)
        d = dims(src.group(1)) if src else None
        if d and ' width=' not in tag:
            tag = tag.replace('<img ', '<img width="%d" height="%d" ' % d, 1)
        return tag
    return re.sub(r'<img [^>]*>', one, s)


def layout(title, desc, url, nav, scripts, body, robots=None):
    head = header
    if nav:
        head = head.replace('class="nl" data-nav="%s"' % nav, 'class="nl active" data-nav="%s" aria-current="page"' % nav)
    hero = re.search(r'url\((/assets/img/[^)]+\.webp)\)', body)
    preload = ('<link rel="preload" href="%s" as="image" fetchpriority="high">\n' % hero.group(1)) if hero else ''
    tt, dd = i18n.plain(title), i18n.plain(desc)
    lv = {l: lver(l) for l in i18n.LANGS if l != 'fr'}
    extra = ''.join('<script src="%s?v=%s" defer></script>\n' % (s, ver(s)) for s in scripts)
    CSS_V, JS_V, BIOS_V, I18N_V = ver('/assets/css/style.css'), ver('/assets/js/site.js'), ver('/assets/js/bios.js'), ver('/assets/js/i18n.js')
    return f'''<!DOCTYPE html>
<html lang="en" data-lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title data-i18n="{tt}">{E(title)}</title>
<meta name="description" content="{E(desc)}" data-i18n-attr="content:{dd}">
{('<meta name="robots" content="%s">' % robots) if robots else ''}
<link rel="canonical" href="{BASE_URL}{url}">
<meta name="theme-color" content="#ffffff">
<meta property="og:type" content="website">
<meta property="og:locale" content="fr_FR">
<meta property="og:site_name" content="{E(SITE)}">
<meta property="og:title" content="{E(title)}" data-i18n-attr="content:{tt}">
<meta property="og:description" content="{E(desc)}" data-i18n-attr="content:{dd}">
<meta property="og:url" content="{BASE_URL}{url}">
<meta property="og:image" content="{BASE_URL}{LOGO}">
<link rel="icon" type="image/png" sizes="32x32" href="/assets/img/favicon-32.png">
<link rel="apple-touch-icon" href="/assets/img/favicon-180.png">
<link rel="preload" href="/assets/fonts/montserrat-latin.woff2" as="font" type="font/woff2" crossorigin>
{preload}<link rel="stylesheet" href="/assets/css/style.css?v={CSS_V}">
<script>{LANG_BOOT.replace('__V__', json.dumps(lv))}</script>
<script>document.documentElement.classList.add("js");try{{if(localStorage.getItem("pa-cookie")==="1")document.documentElement.setAttribute("data-ck","1")}}catch(e){{}}</script>
<script type="speculationrules">{{"prerender":[{{"where":{{"and":[{{"href_matches":"/*"}},{{"not":{{"href_matches":"/assets/*"}}}}]}},"eagerness":"moderate"}}]}}</script>
</head>
<body>
<div style="font-family:'Montserrat',Helvetica,Arial,sans-serif;font-size:16px;line-height:1.7;color:#666;background:#fff">
{head}
<main id="contenu">
{body}
</main>
{footer}
{cookie}
<div id="bio-root"></div>
</div>
<script src="/assets/js/i18n.js?v={I18N_V}" defer></script>
<script src="/assets/js/site.js?v={JS_V}" defer></script>
<script src="/assets/js/bios.js?v={BIOS_V}" defer></script>
{extra}</body>
</html>
'''


def main():
    os.makedirs(os.path.join(ROOT, 'assets', 'css'), exist_ok=True)
    shutil.copyfile(os.path.join(SRC, 'style.css'), os.path.join(ROOT, 'assets', 'css', 'style.css'))
    urls = []
    write_bios()
    for key, out, url, title, desc, nav, scripts in PAGES:
        write(out, bust(layout(title, desc, url, nav, scripts, lazy(i18n.tag(read('pages', key + '.html'), key)))))
        urls.append(url)
    nf = '''<section style="background:#fff;padding:clamp(80px,12vw,140px) 0;text-align:center"><div class="wrap" style="width:min(90%,700px);margin:0 auto">
<h1 style="margin:0 0 14px;font-size:clamp(40px,8vw,72px);font-weight:700;color:#428c9e;line-height:1.1">404</h1>
<p style="margin:0 0 30px;font-size:20px">Cette page est introuvable.</p>
<a href="/" class="h1" style="display:inline-block;background:#428c9e;color:#fff;border-radius:100px;padding:10px 30px;font-size:18px;font-weight:500;border:1px solid #428c9e">Retour à l’accueil</a></div></section>'''
    write('404.html', bust(layout('Page introuvable – Furlan & Associés', 'Cette page est introuvable.', '/404', None, [], lazy(i18n.tag(nf, '404')), robots='noindex')))
    write('sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
          ''.join('  <url><loc>%s%s</loc></url>\n' % (BASE_URL, u) for u in urls) + '</urlset>\n')
    write('robots.txt', 'User-agent: *\nAllow: /\n\nSitemap: %s/sitemap.xml\n' % BASE_URL)
    strings = i18n.REG.save()
    problems = i18n.compile_locales(strings)
    for pb in problems:
        print('i18n problem:', pb)
    for w in i18n.WARN:
        print('i18n warning:', w)
    print('built %d pages + 404, sitemap, robots' % len(PAGES))


if __name__ == '__main__':
    main()
