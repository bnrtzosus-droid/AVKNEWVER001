#!/usr/bin/env python3
"""Generate the static site (one real HTML file per page) from src/.

    python3 tools/build.py

Edit the partials/pages in src/, then re-run this script and commit the result.
Change BASE_URL below if the production domain is not furlan-associes.com.
"""
import hashlib
import html
import json
import os
import re
import shutil
import sys

import i18n

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'src')
BASE_URL = 'https://furlan-associes.com'
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
     'Politique de confidentialité du site furlan-associes.com.', None, []),
    ('cgu', 'cgu.html', '/cgu', 'Conditions générales d’utilisation – Furlan & Associés',
     'Conditions générales d’utilisation du site furlan-associes.com.', None, []),
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


LOCALE = {'fr': 'fr_FR', 'en': 'en_GB', 'de': 'de_DE', 'fi': 'fi_FI', 'sv': 'sv_SE', 'it': 'it_IT'}


def lurl(lang, url):
    """Public path of a page in a language: French at the root, the others under /en/, /de/ ..."""
    if lang == 'fr':
        return url
    return '/%s/' % lang if url == '/' else '/%s%s' % (lang, url)


# runs in <head> of the French (root) pages only, before first paint.
# Language of a visitor arriving on the root: saved choice > browser language > English.
# (pages that already carry a language prefix, /it/ ..., are explicit and are never redirected)
LANG_BOOT = """(function(){var d=document.documentElement,S=["en","de","fr","fi","sv","it"],l;
var q=/[?&]lang=([a-z]{2})(?=&|$)/i.exec(location.search);
if(q&&S.indexOf(q[1].toLowerCase())>-1){l=q[1].toLowerCase();try{localStorage.setItem("pa-lang",l)}catch(e){}
var b=location.pathname.replace(/^\\/(en|de|fi|sv|it)(?=\\/|$)/,"")||"/",s=location.search.replace(/([?&])lang=[a-z]{2}(&|$)/i,function(m,a,z){return z?a:""}).replace(/[?&]$/,"");
location.replace((l==="fr"?b:"/"+l+(b==="/"?"/":b))+s+location.hash);return}
if(d.getAttribute("data-root")!=="1")return;
if(/bot|crawl|spider|slurp|google|bing|yandex|baidu|duckduck|facebookexternalhit|linkedin|whatsapp|preview/i.test(navigator.userAgent||""))return;
try{l=localStorage.getItem("pa-lang")}catch(e){}
if(S.indexOf(l)<0){l=null;var n=navigator.languages&&navigator.languages.length?navigator.languages:[navigator.language||""];
for(var i=0;i<n.length&&!l;i++){var c=String(n[i]).toLowerCase().split(/[-_]/)[0];if(S.indexOf(c)>-1)l=c}if(!l)l="en"}
if(l==="fr")return;var p=location.pathname;
location.replace((d.getAttribute("data-nf")==="1"?"/"+l+"/404.html":"/"+l+(p==="/"?"/":p))+location.search+location.hash)})();"""


def write_bios():
    """assets/js/bios.<lang>.js (window.PA_BIOS) from src/bios.json, already translated."""
    with open(os.path.join(SRC, 'bios.json'), encoding='utf8') as f:
        data = json.load(f)
    ids = []
    for b in data:
        ids.append(i18n.plain(b['cta']))
        for blk in b['blocks']:
            ids.append(i18n.plain(blk['text']))
            ids += [i18n.plain(t) for t in blk['items']]
    return data


def write_bios_lang(data, lang, strings):
    out = json.loads(json.dumps(data))
    for b in out:
        b['cta'] = strings[i18n.plain(b['cta'])]
        for blk in b['blocks']:
            blk['text'] = strings[i18n.plain(blk['text'])]
            blk['items'] = [strings[i18n.plain(t)] for t in blk['items']]
    with open(os.path.join(ROOT, 'assets', 'js', 'bios.%s.js' % lang), 'w', encoding='utf8', newline='\n') as f:
        f.write('window.PA_BIOS=' + json.dumps(out, ensure_ascii=False) + ';\n')


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


def langsw(kind, lang, url):
    """Language selector: a dropdown in the top bar, a plain list in the mobile menu.
    Every option is a real link to the same page in the other language."""
    items = ''.join(
        '<li role="presentation"><a role="option" href="%s" hreflang="%s" lang="%s" data-lang="%s"%s><img class="flag" src="/assets/img/flags/%s.svg" alt="" width="22" height="22"><span>%s</span></a></li>'
        % (lurl(c, url), c, c, c, ' class="on" aria-selected="true"' if c == lang else ' aria-selected="false"', f, n) for c, n, f in LANG_NAMES)
    flag = dict((c, f) for c, n, f in LANG_NAMES)[lang]
    return ('<div class="langsw %s" translate="no"><button type="button" class="lang-cur" aria-haspopup="listbox" aria-expanded="false" '
            'aria-label="Langue" data-i18n-attr="aria-label:u.lang"><img class="flag" src="/assets/img/flags/%s.svg" alt="" width="22" height="22">'
            '<span class="lc">%s</span><svg width="10" height="6" viewBox="0 0 10 6" aria-hidden="true"><path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.6"/></svg></button>'
            '<ul class="lang-list" role="listbox" aria-label="Langue" data-i18n-attr="aria-label:u.lang">%s</ul></div>' % (kind, flag, lang.upper(), items))


header, footer, cookie = i18n.tag(header, 'header'), i18n.tag(footer, 'footer'), i18n.tag(cookie, 'cookie')


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


def layout(lang, title, desc, url, nav, scripts, body, robots=None, notfound=False, strings=None):
    head = header.replace('<!--LANGSW_DESK-->', langsw('desk', lang, '/' if notfound else url)).replace('<!--LANGSW_MOB-->', langsw('mob', lang, '/' if notfound else url))
    if nav:
        head = head.replace('class="nl" data-nav="%s"' % nav, 'class="nl active" data-nav="%s" aria-current="page"' % nav)
    hero = re.search(r'url\((/assets/img/[^)]+\.webp)\)', body)
    preload = ('<link rel="preload" href="%s" as="image" fetchpriority="high">\n' % hero.group(1)) if hero else ''
    tt, dd = i18n.plain(title), i18n.plain(desc)
    extra = ''.join('<script src="%s?v=%s" defer></script>\n' % (s, ver(s)) for s in scripts)
    CSS_V, JS_V, I18N_V, BIOS_V = ver('/assets/css/style.css'), ver('/assets/js/site.js'), ver('/assets/js/i18n.js'), ver('/assets/js/bios.%s.js' % lang)
    ui = json.dumps({k: strings[k] for k in i18n.UI}, ensure_ascii=False)
    public = lurl(lang, url)
    if notfound:
        alternates = og_alt = ''
        canonical = ''
    else:
        alternates = ''.join('<link rel="alternate" hreflang="%s" href="%s%s">\n' % (c, BASE_URL, lurl(c, url)) for c, n, f in LANG_NAMES)
        alternates += '<link rel="alternate" hreflang="x-default" href="%s%s">\n' % (BASE_URL, lurl('en', url))
        og_alt = ''.join('<meta property="og:locale:alternate" content="%s">\n' % LOCALE[c] for c, n, f in LANG_NAMES if c != lang)
        canonical = '<link rel="canonical" href="%s%s">\n' % (BASE_URL, public)
    root_attr = ' data-root="1"' + (' data-nf="1"' if notfound else '') if lang == 'fr' else ''
    return f'''<!DOCTYPE html>
<html lang="{lang}"{root_attr}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title data-i18n="{tt}">{E(title)}</title>
<meta name="description" content="{E(desc)}" data-i18n-attr="content:{dd}">
{('<meta name="robots" content="%s">' % robots) if robots else ''}
{canonical}{alternates}<meta name="theme-color" content="#ffffff">
<meta property="og:type" content="website">
<meta property="og:locale" content="{LOCALE[lang]}">
{og_alt}<meta property="og:site_name" content="{E(SITE)}">
<meta property="og:title" content="{E(title)}" data-i18n-attr="content:{tt}">
<meta property="og:description" content="{E(desc)}" data-i18n-attr="content:{dd}">
<meta property="og:url" content="{BASE_URL}{public}">
<meta property="og:image" content="{BASE_URL}{LOGO}">
<link rel="icon" type="image/png" sizes="32x32" href="/assets/img/favicon-32.png">
<link rel="apple-touch-icon" href="/assets/img/favicon-180.png">
<link rel="preload" href="/assets/fonts/montserrat-latin.woff2" as="font" type="font/woff2" crossorigin>
{preload}<link rel="stylesheet" href="/assets/css/style.css?v={CSS_V}">
<script>{LANG_BOOT}</script>
<script>window.PA_UI={ui};document.documentElement.classList.add("js");try{{if(localStorage.getItem("pa-cookie")==="1")document.documentElement.setAttribute("data-ck","1")}}catch(e){{}}</script>
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
<script src="/assets/js/bios.{lang}.js?v={BIOS_V}" defer></script>
<script src="/assets/js/site.js?v={JS_V}" defer></script>
{extra}</body>
</html>
'''


def render(lang, strings, out, *args, **kw):
    """One finished static page: layout + translation + (for non-French) language-prefixed links."""
    doc = layout(lang, *args, strings=strings, **kw)
    doc = i18n.translate_doc(doc, lang, strings, '' if lang == 'fr' else '/' + lang)
    path = out if lang == 'fr' else '%s/%s' % (lang, out)
    os.makedirs(os.path.dirname(os.path.join(ROOT, path)) or ROOT, exist_ok=True)
    write(path, bust(doc))


def main():
    os.makedirs(os.path.join(ROOT, 'assets', 'css'), exist_ok=True)
    shutil.copyfile(os.path.join(SRC, 'style.css'), os.path.join(ROOT, 'assets', 'css', 'style.css'))
    bios = write_bios()
    bodies = {key: lazy(i18n.tag(read('pages', key + '.html'), key)) for key, *_ in PAGES}
    nf = '''<section style="background:#fff;padding:clamp(80px,12vw,140px) 0;text-align:center"><div class="wrap" style="width:min(90%,700px);margin:0 auto">
<h1 style="margin:0 0 14px;font-size:clamp(40px,8vw,72px);font-weight:700;color:#428c9e;line-height:1.1">404</h1>
<p style="margin:0 0 30px;font-size:20px">Cette page est introuvable.</p>
<a href="/" class="h1" style="display:inline-block;background:#428c9e;color:#fff;border-radius:100px;padding:10px 30px;font-size:18px;font-weight:500;border:1px solid #428c9e">Retour à l’accueil</a></div></section>'''
    nf = lazy(i18n.tag(nf, '404'))
    NF = ('Page introuvable – Furlan & Associés', 'Cette page est introuvable.', '/404', None, [], nf)
    # every id must be registered before the strings are read
    for key, out, url, title, desc, nav, scripts in PAGES:
        i18n.plain(title), i18n.plain(desc)
    i18n.plain(NF[0]), i18n.plain(NF[1])
    problems = []
    for lang in i18n.LANGS:
        strings, pb = i18n.strings_for(lang)
        problems += pb
        write_bios_lang(bios, lang, strings)
        for key, out, url, title, desc, nav, scripts in PAGES:
            render(lang, strings, out, title, desc, url, nav, scripts, bodies[key])
        render(lang, strings, '404.html', *NF, robots='noindex', notfound=True)
    # sitemap with hreflang alternates
    xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n'
    for key, out, url, *_ in PAGES:
        for lang in i18n.LANGS:
            xml += '  <url><loc>%s%s</loc>\n' % (BASE_URL, lurl(lang, url))
            xml += ''.join('    <xhtml:link rel="alternate" hreflang="%s" href="%s%s"/>\n' % (c, BASE_URL, lurl(c, url)) for c in i18n.LANGS)
            xml += '    <xhtml:link rel="alternate" hreflang="x-default" href="%s%s"/>\n  </url>\n' % (BASE_URL, lurl('en', url))
    write('sitemap.xml', xml + '</urlset>\n')
    write('robots.txt', 'User-agent: *\nAllow: /\n\nSitemap: %s/sitemap.xml\n' % BASE_URL)
    i18n.REG.save()
    problems += i18n.compile_locales()
    for pb in sorted(set(problems)):
        print('i18n problem:', pb)
    for w in i18n.WARN:
        print('i18n warning:', w)
    print('built %d pages x %d languages + 404, sitemap, robots' % (len(PAGES), len(i18n.LANGS)))
    if problems:
        sys.exit(1)


if __name__ == '__main__':
    main()
