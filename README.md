# Furlan & Associés – site web

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
- Aucune animation sur les textes ni sur les images ; les avis clients défilent automatiquement (pause au survol/toucher)
- Préchargement de la page suivante au survol (règles de spéculation sur Chromium, `prefetch` ailleurs)
- Polices et images hébergées sur le site (WebP), dimensions des images renseignées par `tools/build.py` (nécessite Pillow : `pip install pillow`)
- Respect de `prefers-reduced-motion` : toutes les animations sont désactivées

## Crédits photos

Photos libres de droits ([licence Unsplash](https://unsplash.com/license)) :

| Emplacement | Photographe |
|---|---|
| Bandeau d’accueil (marteau) | Sasun Bughdaryan |
| Bandeau « Droit de la famille et des successions » (mains de deux générations) | Rod Long |
| Droit des successions (album photo) | Laura Fuhrman |
| Fiscalité du divorce et des successions (calculatrice) | Towfiqu barbhuiya |
| Divorce transfrontalier (alliances) | Mariano Rivas |
| Succession transfrontalière (globe) | Christian Lue |
| Droit de la famille (promenade) | Filip Rankovic Grobgaard |
| Transmission de patrimoine (maison) | Ries Bosch |
| Droit international (statue de la Justice) | Sasun Bughdaryan |
| Bandeau Cabinet (salle de réunion) | Benjamin Child |
| Valeurs du cabinet (poignée de main) | Cytonn Photography |
| Bandeau Actualités et page Droit de la famille (façade, famille) | Chris Bischoff, Margo Evardson |
| Article (Duomo de Milan) | Ouael Ben Salah |
| Bandeau Rendez-vous (marteau et livre) | Sasun Bughdaryan |

Les photos des avocats, les avatars des avis et le logo proviennent du site d’origine pessia-associes.fr.
Les pictogrammes de contact (téléphone, adresse, e-mail) sont des icônes Material Design (Apache 2.0).

## À brancher

Les formulaires (rendez-vous, « Une question ? ») n'envoient pas encore de message : ils attendent un
service d'envoi (e-mail, Resend, etc.).


## Langues (i18n)

Six langues : Français (racine `/`), English `/en/`, Deutsch `/de/`, Suomi `/fi/`, Svenska `/sv/`, Italiano `/it/`.
Chaque langue est une **vraie page statique déjà traduite** (`/it/cabinet`, `/de/rendez-vous`…), générée par
`python3 tools/build.py` : aucune traduction n'est faite dans le navigateur, donc pas de flash et un référencement
séparé par langue.

* **Balises** : `<html lang>`, `canonical`, `hreflang` pour les 6 langues + `x-default` (anglais), `og:locale` /
  `og:locale:alternate`, `sitemap.xml` avec les alternatives de chaque page.
* **Arrivée sur le site** (script dans le `<head>` des pages françaises uniquement) : choix enregistré
  (`localStorage`, clé `pa-lang`, posé quand on clique une langue du sélecteur) › langue du navigateur
  (`navigator.languages` puis `navigator.language`, variantes `it-IT`, `de-DE`… comprises) › anglais.
  Une adresse qui porte déjà un préfixe (`/it/…`) n'est jamais redirigée ; les robots ne sont pas redirigés.
* **Sélecteur** : 6 liens (drapeaux dans `assets/img/flags/`) vers la même page dans l'autre langue.
* **Textes** : les pages sont écrites en français (`src/`). Le build repère chaque texte et lui donne un identifiant
  (`h001` = HTML, `t002` = texte brut ; table dans `tools/i18n/fr.json`, les identifiants ne changent plus).
  Traductions : `tools/i18n/<langue>.txt` (une ligne `identifiant | texte`), compilées en
  `locales/<langue>/translation.json`. Le build s'arrête et liste tout texte manquant ou dont les balises HTML diffèrent.
  Pour ajouter/modifier un texte : éditer la page dans `src/`, lancer le build, puis compléter les 5 fichiers `.txt`.
* **Parties dynamiques** : biographies (`assets/js/bios.<langue>.js`), textes du calendrier (`window.PA_UI`),
  `assets/js/i18n.js` (sélecteur, ajustement des titres trop longs).
* **Tests** : `node tests/i18n.test.js` (détection, priorité, mémorisation, absence de flash, balises SEO,
  6 langues × 8 pages × 5 largeurs d'écran…).
