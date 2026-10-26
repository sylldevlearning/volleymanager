# Plan — Tableau tactique ↔ match (persistance + « Appliquer au match »)

## Bug corrigé (lot 1)
Ouvert depuis un match, le tableau était réinitialisé à chaque réouverture :
l'état n'était qu'en mémoire et l'ouverture forçait `isSyncedWithMatch = true`.

## Lot 1 — Persistance par match
- `src/features/tactical/boardPersistence.ts` : une sauvegarde AsyncStorage par
  match (`@volleymanager/tactical_board/<matchId>`), comme les jeux enregistrés.
  Contenu : positions, bancs, flèches, tracés, ordre des tracés, étape courante,
  historique des étapes, jeu chargé, format, et « suit le match ».
- `tacticalStore` : `getSnapshot()` / `restoreSnapshot()`.
- `TacticalBoard` :
  - à l'ouverture, restaure la sauvegarde ; sinon tableau vierge synchronisé ;
  - auto-sauvegarde 500 ms après chaque changement, et immédiatement à la fermeture ;
  - un tableau jamais modifié continue de suivre le match (rotations, remplacements) ;
  - modifier un joueur, charger un jeu ou changer de format compte comme une modification ;
  - « Sync match » revient à l'état du match (et écrase la sauvegarde).
- `deleteMatch` / `deleteAllMatches` suppriment aussi la/les sauvegardes
  (les jeux enregistrés ne sont pas touchés).
- Tests : `__tests__/tactical-persistence.test.ts`. AsyncStorage est mocké pour
  toutes les suites (`__tests__/helpers/jest.setup.ts`).

## Lot 2 — Différences tableau ↔ match (`matchDiff.ts`, pur)
- `tacticalStore.benchMoves` : journal des échanges / sorties / entrées du banc
  (sauvegardé avec le tableau, vidé à chaque sync et après application).
- `computeBoardSubstitutions` : paires suivant les échanges (chaînes regroupées,
  aller-retour annulé), sinon zone occupée ; jetons fictifs ignorés.
- `positionsToLineup` : zone I–VI la plus proche ; erreurs 6 joueurs,
  deux dans la même zone, libéro dans les 6.

## Lot 3 — Pendant un set
- Bug corrigé (écran de match) : « Annuler » sur un remplacement remet terrain,
  banc, libéro, paires et quota (`revertSubstitution`, infos dans `UndoResult`).
- Bug corrigé (tous les écrans) : le joueur sorti revient au banc (sauf
  remplacement exceptionnel), en direct et au rejeu.
- La fiche de remplacement de l'écran de match utilise `rulesValidator` (strict).
- `recordSubstitution` : enregistrement partagé (fiche + tableau), sortie du libéro incluse.
- `checkBoardSubstitutions` : validation séquentielle, tout-ou-rien ;
  nouvelle règle « le libéro ne sort que pour le joueur qu'il a remplacé ».

## Lot 4 — Entre deux sets
- `matchPhase` : `before_first_point` (aucun échange dans le set) / `in_set` / `set_over`.
- `planBoardApply` : remplacements pendant un set, composition de départ avant le
  premier point ; un jeu dessiné hors zones est ignoré si les joueurs n'ont pas changé.
- `applyBoardLineup` : `saveLineup` + terrain, sans remplacement ; reprise du
  match rapide avec la composition enregistrée.

## Lot 5 — Interface
- Bouton « Appliquer au match » (tableau ouvert depuis un match en salle).
- `ApplyToMatchSheet` : « 7 entre à la place de 12 » + message d'erreur ;
  « Valider » désactivé si un remplacement est refusé.
- En quittant avec des différences applicables : « Appliquer ces changements au
  match ? » Maintenant / Plus tard (« Plus tard » ne touche pas au match).
- Aide « ? » dédiée au tableau ouvert depuis un match (`help.tacticalMatch`).
- Remplacement exceptionnel : uniquement depuis la fiche de remplacement.
