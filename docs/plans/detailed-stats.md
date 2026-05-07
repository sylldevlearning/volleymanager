# Plan — Statistiques Détaillées avec Graphiques

## Objectif
Visualisation complète des performances individuelles et collectives via 3 nouveaux écrans + enrichissement du statsService.

## Screens
1. `app/match/[id]/stats.tsx` — Dashboard match (comparaison équipes, top performeurs, liste joueurs)
2. `app/match/[id]/player-stats/[playerId].tsx` — Fiche stats joueur (radar, barres, progression par set)
3. `app/player/[id]/stats.tsx` — Historique carrière (moyennes, records, évolution)

## Composants graphiques
- `src/components/charts/MirrorBar.tsx` — Barres miroir horizontales (comparaison équipes)
- `src/components/charts/ProgressBar.tsx` — Barre colorée rouge→vert selon la valeur
- `src/components/charts/LineChart.tsx` — Courbe SVG (progression par set/match)
- `src/components/charts/StatCard.tsx` — Card icône + valeur + label
- `src/components/charts/TopPerformerCard.tsx` — Card podium joueur

## Service enrichi
Nouvelles interfaces : `PlayerMatchStats`, `TeamMatchStats`, `MatchDashboardData`, `SetBreakdown`, `PlayerCareerStats`
Nouvelles méthodes : `getMatchDashboard`, `getPlayerMatchStats`, `getPlayerSetStats`, `getPlayerCareerStats`

## Ordre d'implémentation
1. i18n → 2. model/stats.ts → 3. eventService + statsService → 4. Tests → 5. Composants → 6. Écrans → 7. Intégration
