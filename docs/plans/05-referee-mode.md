# Plan Phase 5 — Mode Arbitre (Scoring Live)

## Objectif
Écran de scoring live permettant d'arbitrer un match entier indoor 6v6 ou beach 2v2.
Utilisable d'un seul doigt, debout, sans regarder l'écran.

## Composants à créer

### ScoreBoard (src/components/scoring/ScoreBoard.tsx)
- Score géant (96px Inter Black) pour chaque équipe
- Couleur domicile (#1D4ED8) / extérieur (#E63946)
- Animation scale sur changement de score

### ScoreButton (src/components/scoring/ScoreButton.tsx)
- Bouton ≥ 88dp (SCORE_BUTTON_SIZE = 88)
- Feedback haptique via expo-haptics
- Animation scale (0.93→1) via Reanimated 4 + Gesture Handler
- Double tap protection (500ms debounce)

### SetTracker (src/components/scoring/SetTracker.tsx)
- Badges petits pour chaque set joué
- Score du set affiché (ex: 25-20)
- Set en cours indiqué visuellement

### UndoButton (src/components/scoring/UndoButton.tsx)
- Annule le dernier événement non-annulé
- Confirmation si match important

## Modèle de données impacté
- match_events (append-only) — source de vérité
- scoringStore (Zustand) — état dérivé des events

## Flux principal
1. Chargement du match → initMatch() dans scoringStore
2. Premier set créé automatiquement → createSet(matchId, 1)
3. Tap sur bouton équipe → addEvent(point_home/point_away) + haptic
4. Recalcul score depuis events → computeScore()
5. Vérification win conditions → isSetWon() → isMatchWon()
6. Fin de set → endCurrentSet() + createSet(matchId, setNum+1)
7. Fin de match → updateMatchStatus('finished', winnerId)
8. Undo → undoLastEvent() → scoringStore.undoPoint()

## Règles FIVB encodées
- Rotation auto à la récupération du service (side-out)
- P1 = serveur
- Changement côté beach tous les 7pts (5 au set décisif)
- Sets à 25pts (15 au 5e), 2pts d'écart minimum
- 3 sets gagnants indoor / 2 sets gagnants beach

## Cas limites
- Double tap rapide → debounce 500ms
- Undo sur set vide → ignorer
- Undo après fin de set → non autorisé
- Écran tenu à l'envers → pas de rotation UI (portrait lock)
- Timer tick sans leak → cleanup useEffect

## Critères de succès
- [ ] Tap +1 ajoute un point et met à jour l'affichage < 50ms
- [ ] Haptique déclenché à chaque point
- [ ] Undo fonctionne et recalcule le score
- [ ] Fin de set détectée automatiquement + transition vers set suivant
- [ ] Fin de match détectée et navigation vers summary
- [ ] Rotation s'affiche et s'incrémente au side-out
