# Démo — données d'exemple, plus de vrais noms, bugs du résumé

Branche `feat/demo` (depuis main, après la 1.2.3). Pas de build.

## 1. Plus aucun vrai nom

- `seedService.ts` : suppression des effectifs France / Brésil (JO 2024) et de la
  création automatique de ces équipes.
- `store-assets/listing.md` (ancien texte « France et Brésil pré-chargés ») : ligne retirée.
- Téléphones qui ont déjà ces deux équipes : une migration unique les supprime
  **seulement si elles sont intactes** (même nom, mêmes 13 joueurs avec les mêmes
  numéros et noms) **et jamais utilisées** (aucun match ni tournoi). Sinon on n'y
  touche pas : ce sont devenues les données de l'utilisateur.
- Test-garde : aucun des 26 noms de la liste ne figure dans `app/` ni `src/`.

## 2. Données d'exemple

**Marquage** : colonne `is_sample INTEGER DEFAULT 0` sur `teams`, `matches`,
`tournaments` (migration). Joueurs, sets, événements, alignements et matchs de
tournoi suivent leur parent (suppression en cascade).

**Création** : `sampleDataService.createSampleDataIfEmpty()` au démarrage, à la
place de l'ancien seed, uniquement si l'app n'a aucune équipe, aucun match et aucun
tournoi. Elle ne se fait qu'une fois : un indicateur dans les réglages empêche
qu'elle revienne après « Supprimer les exemples ».

**Contenu** (noms inventés, courants, aucun joueur ni club réel ; toutes les
données dans `src/features/sample/sampleData.ts`) :
- 2 équipes de 12 joueurs, nommées dans la langue du téléphone (par exemple « Les Mouettes » et « Les Hérons ») : 2 passeurs,
  2 pointus, 4 réceptionneurs-attaquants, 3 centraux, 1 libéro. Le capitaine est fixé au niveau du match, comme dans l'app.
- Alignement 5-1 de chaque équipe : passeur en 1, réceptionneur-attaquant en 2,
  central en 3, pointu en 4, réceptionneur-attaquant en 5, central en 6. Le libéro
  remplace les centraux en zone arrière.
- Match terminé 3-1, construit avec les vrais événements de l'app (points,
  remplacements, entrées et sorties du libéro, temps morts, stats joueurs). Les
  événements sont générés par une fonction pure, avec une graine fixe pour qu'ils
  soient reproductibles, puis rejoués par `matchStateReconstruction`. Les scores des
  sets et le vainqueur viennent de ce rejeu, jamais écrits « en dur ».
- Tournoi de 8 équipes fictives (8 noms inventés), poules de 4 + phases finales.
  Il est créé par le moteur de tournoi existant, puis la moitié des matchs (toute la
  phase de poules, par exemple) reçoit des scores tirés avec une graine fixe
  (`devRandomScores`). Planning, matchs et classement sont donc remplis.

**Affichage** : badge « Exemple » sur les équipes, les matchs et le tournoi
d'exemple.

**Paramètres** : « Supprimer les exemples », avec confirmation. Ce bouton supprime
tout ce qui a `is_sample = 1` et rien d'autre.

**Exclus des vrais chiffres** :
- la demande de note (`finishedMatchCount` sans les matchs d'exemple) ;
- les statistiques globales : historique et carrière des joueurs, statistiques
  d'équipe, compteurs de l'accueil.

Les exemples gardent leurs propres stats dans leurs écrans (résumé, stats du match).

## 3. Bugs du résumé

- **Match arrêté** (terminé avant la fin) : « Terminer le match » enregistre les
  points du set en cours (calculés depuis les événements) et aucun vainqueur. Le
  résumé affiche « Match arrêté », sans trophée, avec le score au moment de
  l'arrêt, set en cours compris (« Set 3 (arrêté) »). Les anciens matchs arrêtés
  sont réparés à l'affichage. Un match de tournoi arrêté ne donne pas de QR du
  résultat. L'export du tournoi ne lit pas les matchs arbitrés : rien à changer.
- **Graphique vide, libellés qui se chevauchent.** Les 8 barres ont chacune un
  libellé de 10 px sur environ 40 px de largeur. Correction :
  - barres groupées par compétence, sans libellé par barre (les groupes sont déjà
    nommés en dessous) ;
  - quand toutes les valeurs sont à 0, un message « Aucune statistique saisie » au
    lieu d'un graphique vide (cas des matchs arbitrés sans stats joueurs).
- **Abréviations anglaises** (`Ace`, `Kill`, `Srv%`, `Atk%`, `Rec%` codées en dur).
  Nouvelles clés `stats.short.*` dans les 11 langues. Par exemple en français :
  Ace, Pts, Serv. %, Att. %, Réc. %.

## Tests (écrits avant le code)

- **Vrais noms** : aucun des noms de l'ancien seed dans `app/` ni `src/`. Migration :
  supprime l'équipe intacte et inutilisée, garde une équipe modifiée ou utilisée.
- **Données d'exemple** :
  - 12 joueurs par équipe, postes, numéros uniques ;
  - alignement 5-1 (passeur 1, pointu 4, réceptionneurs-attaquants 2 et 5,
    centraux 3 et 6) ;
  - le rejeu du match donne 3-1 et des sets valides (25 points ou plus avec 2
    d'écart, 15 au tie-break) ;
  - remplacements valides selon les règles de l'app ;
  - le tournoi a 8 équipes, la moitié des matchs joués et un classement cohérent ;
  - création seulement si l'app est vide, et une seule fois ;
  - « Supprimer les exemples » ne touche pas aux données réelles ;
  - la demande de note ignore les matchs d'exemple.
- **Résumé** : graphique groupé par compétence ; message quand aucune statistique
  n'a été saisie.
- **i18n** : les nouvelles clés existent dans les 11 langues ; plus de libellé
  anglais codé en dur dans `summary.tsx`.

## Décisions

- Équipes France / Brésil déjà présentes : supprimées seulement si intactes et
  jamais utilisées (validé).
- Un seul libéro par équipe d'exemple (l'app suit le premier libéro de l'effectif).
- « Vrais chiffres » : la demande de note ne compte que les matchs terminés dans
  l'app (les exemples n'y entrent pas). Il n'existe pas d'autre statistique
  globale : les statistiques d'équipe et de joueur ne mélangent pas exemples et
  données réelles (équipes distinctes).
- Une équipe d'exemple utilisée ensuite dans un vrai match est gardée et devient
  une équipe de l'utilisateur.
