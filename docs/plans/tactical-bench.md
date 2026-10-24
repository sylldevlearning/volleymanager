# Plan — Banc des remplaçants du tableau tactique

## Contexte
Le tableau tactique affichait un banc en colonnes latérales, uniquement quand le
match avait des remplaçants dans `scoringStore`. Depuis l'accueil ou un match
rapide (équipes sans effectif), aucun banc n'apparaissait. L'échange gardait le
`playerId` du sortant (doublon terrain/banc) et ne coupait pas la synchro match.
Impossible de faire sortir un joueur du terrain.

## Comportement attendu
- Banc en bande horizontale **sous le terrain** : Domicile à gauche, Extérieur à droite.
- Contenu :
  - équipe avec effectif → joueurs non alignés (banc du match, libéro inclus) ;
  - équipe sans effectif (accueil, match rapide) → remplaçants **7 à 12** ;
  - beach 2v2 → pas de banc.
- Tap sur un remplaçant → même fiche d'édition que sur le terrain (numéro, nom, couleur).
- Glisser banc → joueur du terrain (même équipe, rayon 28 px) = échange, l'entrant prend la place exacte.
- Glisser banc → zone vide du terrain = entrée à cet endroit si l'équipe a < 6 joueurs, sinon retour au banc.
- Glisser terrain → banc = sortie (le ballon ne peut pas sortir).
- Placement libre : inchangé (tout le terrain, clamp 0.02–0.98).
- Toute modification du banc coupe la synchro match ; « Sync match » restaure terrain + banc.
- Aucun remplacement réel n'est enregistré dans le match (bac à sable).
- Match sans composition (match rapide) : positions par défaut 1–6 au lieu d'un terrain vide.

## Architecture
- `src/models/tactical.ts` : type `BenchPlayer`.
- `src/features/tactical/benchUtils.ts` (pur, testé) : `buildDefaultBench`, `benchFromPlayers`,
  `swapWithBench`, `sendToBench`, `enterFromBench`, `findTokenAt`, `MAX_ON_COURT`.
- `src/features/tactical/tacticalStore.ts` : `benchHome` / `benchAway`, `setBench`,
  `swapWithBench`, `sendToBench`, `enterFromBench` ; `updatePlayerInfo` couvre aussi le banc ;
  `loadPlay` retire du banc les joueurs présents dans le schéma ; `resetBoard` vide le banc.
- `src/components/tactical/TacticalBoard.tsx` : bande de banc, détection de dépôt, tap → édition.
- `src/components/tactical/PlayerToken.tsx` : `onDragStart` + coordonnées absolues en fin de drag.

## Tests
`__tests__/tactical-bench.test.ts` (utils purs + actions du store).
