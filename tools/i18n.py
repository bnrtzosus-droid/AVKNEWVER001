"""Build-time helper for the multilingual site.

The pages are written in French (source language).  Every translatable string
(text of an element, or an attribute such as alt / placeholder / aria-label /
title) gets a stable id:

    h001  -> HTML string (may contain inline tags such as <strong>, <a>)
    t002  -> plain text string (attributes, <title>, meta tags, JS texts)

The element is tagged with data-i18n="h001" (content) and/or
data-i18n-attr="alt:t002,aria-label:t003" (attributes).  At run time
assets/js/i18n.js replaces them with the text of locales/<lang>/translation.json.

tools/i18n/fr.json keeps the id <-> French text table (ids never change once
assigned).  locales/<lang>/translation.json for en, de, fi, sv, it are written by
hand; tools/check_i18n.py verifies that none is missing a string.
"""
import html as _html
import json
import os
import re

from bs4 import BeautifulSoup, NavigableString, Comment

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TABLE = os.path.join(ROOT, 'tools', 'i18n', 'fr.json')
LANGS = ['en', 'de', 'fr', 'fi', 'sv', 'it']

INLINE = {'a', 'strong', 'b', 'em', 'i', 'u', 'span', 'br', 'small', 'sup', 'sub', 'mark', 'abbr', 'wbr'}
SKIP = {'script', 'style', 'noscript', 'svg', 'title', 'head'}
ATTRS = ('alt', 'title', 'placeholder', 'aria-label')

# texts produced by JavaScript (calendar, dialogs ...)
UI = {
    'u.close': 'Fermer',
    'u.prevmonth': 'Mois précédent',
    'u.nextmonth': 'Mois suivant',
    'u.times': 'Horaires',
    'u.pickday': 'Choisissez d’abord un jour disponible (du lundi au vendredi).',
    'u.lang': 'Langue',
    'u.langtitle': 'Langue du site',
}


class Registry:
    def __init__(self):
        self.fr = {}
        if os.path.exists(TABLE):
            with open(TABLE, encoding='utf8') as f:
                self.fr = json.load(f)
        self.rev = {k[0] + '|' + v: k for k, v in self.fr.items() if re.match(r'[ht]\d+$', k)}
        self.n = max([int(k[1:]) for k in self.fr if re.match(r'[ht]\d+$', k)] + [0])
        self.used = set()
        for k, v in UI.items():
            self.fr[k] = v
            self.used.add(k)

    def get(self, mode, text):
        key = mode + '|' + text
        if key in self.rev:
            i = self.rev[key]
        else:
            self.n += 1
            i = '%s%03d' % (mode, self.n)
            self.rev[key] = i
            self.fr[i] = text
        self.used.add(i)
        return i

    def save(self):
        out = {k: v for k, v in self.fr.items() if k in self.used}
        os.makedirs(os.path.dirname(TABLE), exist_ok=True)
        with open(TABLE, 'w', encoding='utf8', newline='\n') as f:
            json.dump(dict(sorted(out.items())), f, ensure_ascii=False, indent=1)
            f.write('\n')
        d = os.path.join(ROOT, 'locales', 'fr')
        os.makedirs(d, exist_ok=True)
        with open(os.path.join(d, 'translation.json'), 'w', encoding='utf8', newline='\n') as f:
            json.dump({'lang': 'fr', 'strings': dict(sorted(out.items()))}, f, ensure_ascii=False, indent=1)
            f.write('\n')
        return out


REG = Registry()

def norm(s):
    return re.sub(r'\s+', ' ', s).strip()


def _has_direct_text(el):
    return any(isinstance(c, NavigableString) and not isinstance(c, Comment) and re.search(r'[^\W\d_]', c) for c in el.children)


def _only_inline(el):
    return all(d.name in INLINE for d in el.find_all(True))


WARN = []


def _process(el, where):
    if el.name in SKIP:
        return
    attrs = []
    for a in ATTRS:
        v = el.get(a)
        if v and v.strip() and not (el.name == 'iframe' and a != 'title'):
            attrs.append('%s:%s' % (a, REG.get('t', norm(v))))
    if attrs:
        el['data-i18n-attr'] = ','.join(attrs)
    if _has_direct_text(el):
        if _only_inline(el):
            el['data-i18n'] = REG.get('h', norm(el.decode_contents()))
            return
        else:
            # text mixed with block children (labels, icons ...): wrap each text run in a <span>
            soup = el
            while soup.parent is not None:
                soup = soup.parent
            for c in list(el.children):
                if isinstance(c, NavigableString) and not isinstance(c, Comment) and re.search(r'[^\W\d_]', c):
                    sp = BeautifulSoup('<span></span>', 'html.parser').span
                    sp['data-i18n'] = REG.get('h', _html.escape(norm(str(c)), quote=False))
                    sp.string = str(c).strip()
                    lead = ' ' if str(c)[:1].isspace() else ''
                    trail = ' ' if str(c)[-1:].isspace() else ''
                    c.replace_with(sp)
                    if lead:
                        sp.insert_before(NavigableString(lead))
                    if trail:
                        sp.insert_after(NavigableString(trail))
            for c in el.find_all(True, recursive=False):
                if not c.has_attr('data-i18n'):
                    _process(c, where)
            return
    for c in el.find_all(True, recursive=False):
        _process(c, where)


def tag(fragment, where=''):
    """Return the fragment with data-i18n attributes added."""
    soup = BeautifulSoup(fragment, 'html.parser')
    for c in soup.find_all(True, recursive=False):
        _process(c, where)
    return str(soup)


def plain(text):
    """Register a plain text (title, meta description ...) and return its id."""
    return REG.get('t', norm(text))


# ---------------------------------------------------------------- translations
# strings that are identical in every language (names, addresses, e-mail ...)
INVARIANT_RE = re.compile(r'^(?:[\w.+-]+@[\w.-]+|OK|Furlan &(?:amp;)? Associés|Piazza Castello.*|[A-Za-z][\w\'’-]+(?: [A-Z][\w\'’-]+){0,2}|\d+ \d+ \d+ \d+ \d+)$')


def _read_txt(lang):
    path = os.path.join(ROOT, 'tools', 'i18n', lang + '.txt')
    out = {}
    with open(path, encoding='utf8') as f:
        for n, line in enumerate(f, 1):
            line = line.rstrip('\n')
            if not line.strip():
                continue
            i = line.index(' | ')
            out[line[:i].strip()] = line[i + 3:]
    return out


def _tags(s):
    return sorted(re.findall(r'<[^>]+>', s))


def strings_for(lang):
    """(id -> text for one language, problems).  French = the source texts."""
    used = {k: v for k, v in REG.fr.items() if k in REG.used}
    if lang == 'fr':
        return used, []
    tr = _read_txt(lang)
    out, problems = {}, []
    for k, fr in sorted(used.items()):
        if k in tr:
            v = tr[k]
            if k[0] == 'h' and _tags(v) != _tags(fr):
                problems.append('%s %s: HTML tags differ from the French source' % (lang, k))
            out[k] = v
        elif INVARIANT_RE.match(fr) and (fr.startswith('Piazza') or len(fr.split()) <= 4):
            out[k] = fr
        else:
            problems.append('%s %s: missing translation (%s)' % (lang, k, fr[:50]))
            out[k] = fr
    for k in tr:
        if k not in used:
            problems.append('%s %s: unknown id (not used by the site any more)' % (lang, k))
    return out, problems


def compile_locales():
    """Write locales/<lang>/translation.json for every language and return the problems found."""
    problems = []
    for lang in LANGS:
        out, pb = strings_for(lang)
        problems += pb
        d = os.path.join(ROOT, 'locales', lang)
        os.makedirs(d, exist_ok=True)
        with open(os.path.join(d, 'translation.json'), 'w', encoding='utf8', newline='\n') as f:
            json.dump({'lang': lang, 'strings': out}, f, ensure_ascii=False, indent=1)
            f.write('\n')
    return problems


def translate_doc(doc, lang, strings, prefix=''):
    """Apply the strings of one language to a finished HTML document (static, no JavaScript needed).
    Internal links get the language prefix (/it/...)."""
    soup = BeautifulSoup(doc, 'html.parser')
    for el in soup.find_all(attrs={'data-i18n': True}):
        i = el['data-i18n']
        if lang != 'fr' and i in strings:
            if i[0] == 't':
                el.string = strings[i]
            else:
                el.clear()
                el.append(BeautifulSoup(strings[i], 'html.parser'))
        del el['data-i18n']
    for el in soup.find_all(attrs={'data-i18n-attr': True}):
        for pair in el['data-i18n-attr'].split(','):
            a, i = pair.split(':')
            if lang != 'fr' and i in strings:
                el[a] = strings[i]
        del el['data-i18n-attr']
    if prefix:
        for a in soup.find_all('a', href=True):
            h = a['href']
            if h.startswith('/') and not h.startswith('//') and not re.match(r'/(assets|locales)/', h) and not h.startswith(prefix + '/') and not a.has_attr('data-lang'):
                a['href'] = prefix + h
    return str(soup)
