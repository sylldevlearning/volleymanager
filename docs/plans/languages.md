# Langues — plan (fait)

## Objectif
L'app en 11 langues, sans écriture de droite à gauche : français, anglais,
espagnol, portugais (Brésil), italien, allemand, polonais, turc, russe,
japonais, chinois simplifié.

## Choix
- `src/i18n/languages.ts` : liste des langues (code = code i18next = locale
  Intl), détection de la langue du téléphone (portugais → pt-BR ; chinois
  simplifié seulement, pas Taïwan / Hong Kong / Macao ; sinon anglais).
- Préférence stockée : `'system'` (par défaut) ou une langue. Migration v1 du
  store : l'ancien défaut « fr » devient « system » (un téléphone en français
  reste en français), « en » reste un choix manuel.
- Paramètres : une ligne « Langue » qui ouvre la liste (« Langue du téléphone
  (…) » en premier). Le layout racine applique la préférence et suit un
  changement de langue du téléphone (`useLocales`).
- `intl-pluralrules` : règles de pluriel de chaque langue (polonais, russe :
  one / few / many), quel que soit le moteur JS.
- `src/i18n/format.ts` : dates, heures (24 h avec zéro initial, ou 12 h en
  anglais) et nombres / pourcentages par `Intl`, à l'écran comme dans le PDF.
- Ordinaux par langue (1er, 1st, 1.º, 1., 1-е, 1位, 第1名).
- Libellés serrés (boutons d'arbitrage, barre du tableau tactique, onglets,
  en-têtes de tableau) : longueur maximale testée dans chaque langue, et texte
  sur une ligne qui rétrécit si besoin.

## Tests
- Chaque clé du français existe dans toutes les langues, et aucune autre ;
  mêmes `{{variables}}` ; formes de pluriel utiles à chaque langue.
- Détection et préférence, migration, formats de date / heure / nombre.
- Largeur des libellés serrés.

## Relecture
`docs/glossaire-volley.md` : termes de volley et de tournoi par langue.
