# Pessia & Associés – site web

Site statique multi-pages (HTML / CSS / JS, sans dépendance), avec de vraies adresses :

| Adresse | Fichier |
|---|---|
| `/` | `index.html` |
| `/cabinet` | `cabinet.html` |
| `/droit-de-la-famille` (ancres `#succesion`, `#fiscalite`, `#divorce-transfrontalier`, `#succession-transfrontaliere`, `#famille`, `#patrimoine`, `#dip`) | `droit-de-la-famille.html` |
| `/actualites` | `actualites.html` |
| `/enjeux-droit-famille-patrimoine` | `enjeux-droit-famille-patrimoine.html` |
| `/rendez-vous` | `rendez-vous.html` |
| `/politique-de-confidentialite` | `politique-de-confidentialite.html` |
| `/cgu` | `cgu.html` |
| page introuvable | `404.html` |

`.htaccess` fournit les adresses propres sans `.html`, la redirection https, la page 404, la compression et le cache.
`sitemap.xml` et `robots.txt` sont générés.

## Modifier le site

Les fichiers `.html` à la racine sont **générés** : ne les modifiez pas à la main.

- `src/partials/` : en-tête, pied de page, bandeau cookies (partagés par toutes les pages)
- `src/pages/` : contenu de chaque page
- `src/style.css` → `assets/css/style.css`
- `assets/js/site.js` : menu mobile, fiches des avocats, carrousel d'avis, cookies
- `assets/js/bios.js` : biographies des avocats

```bash
python3 tools/build.py      # régénère les pages, le sitemap et robots.txt
python3 tools/serve.py      # aperçu local sur http://localhost:8000 (mêmes adresses propres)
```

Si le domaine de production n'est pas `pessia-associes.fr`, changez `BASE_URL` dans `tools/build.py`
(balises canoniques, sitemap, robots.txt) puis relancez le build.

## Effets et performance

- Transition en fondu entre les pages (View Transitions inter-documents ; repli sans animation sur les anciens navigateurs)
- Préchargement de la page suivante au survol (règles de spéculation sur Chromium, `prefetch` ailleurs)
- Apparition progressive du contenu au défilement ; le contenu reste visible sans JavaScript
- Polices et images hébergées sur le site (WebP), dimensions des images renseignées par `tools/build.py` (nécessite Pillow : `pip install pillow`)
- Respect de `prefers-reduced-motion` : toutes les animations sont désactivées

## À brancher

Les formulaires (rendez-vous, « Une question ? ») n'envoient pas encore de message : ils attendent un
service d'envoi (e-mail, Resend, etc.).
