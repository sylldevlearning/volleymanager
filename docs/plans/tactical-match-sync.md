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

## Lots suivants
2. `matchDiff.ts` (pur) : remplacements déduits du tableau (échanges en chaîne
   regroupés, aller-retour annulé), positions → zones I–VI, jetons fictifs ignorés.
3. Pendant un set : validation séquentielle `rulesValidator`, récapitulatif
   « 7 entre à la place de 12 », tout-ou-rien, vrais remplacements annulables.
   Les positions ne sont jamais appliquées pendant un set.
   La fiche de remplacement de l'écran de match passe aussi sur `rulesValidator`.
   Vérifier (et corriger) qu'Annuler un remplacement remet le joueur sur le terrain.
4. Entre deux sets (0–0, aucun point) : positions → composition de départ
   (`saveLineup`), sans quota de remplacements.
5. UI : bouton « Appliquer au match », « Appliquer ces changements au match ? »
   Maintenant / Plus tard en quittant avec des différences applicables,
   textes FR/EN, aide « ? ». Remplacement exceptionnel : fiche de remplacement uniquement.
