# Plan — Tactical Board

## Contexte
Outil plein-écran intégré au match live (arbitre/coach), accessible pendant les temps morts. L'entraîneur dessine des schémas tactiques en moins de 10s.

## Contraintes
- Vitesse d'interaction absolue : 1 tap pour ouvrir, drag immédiat
- Ne doit PAS modifier la rotation réelle du match (visualisation seule)
- Compatible indoor 6v6 et beach 2v2

## Architecture

### Fichiers à créer
```
src/models/tactical.ts
src/features/tactical/positionUtils.ts
src/features/tactical/defaultPlays.ts
src/features/tactical/tacticalStore.ts
src/features/tactical/tacticalService.ts
src/components/tactical/CourtSVG.tsx
src/components/tactical/ArrowPath.tsx
src/components/tactical/ArrowOverlay.tsx
src/components/tactical/PlayerToken.tsx
src/components/tactical/ToolBar.tsx
src/components/tactical/PlaybackControls.tsx
src/components/tactical/PlaybookSheet.tsx
src/components/tactical/TacticalBoard.tsx
__tests__/tactical-store.test.ts
__tests__/tactical-positions.test.ts
__tests__/tactical-default-plays.test.ts
```

### Fichiers à modifier
```
src/services/database.ts      (migration v2 : table tactical_plays)
src/i18n/fr.json              (clés tactical)
src/i18n/en.json              (clés tactical)
app/match/[id]/referee.tsx    (bouton Tactique)
```

## Système de coordonnées

Court affiché en portrait (téléphone vertical) :
- x: 0 (gauche) → 1 (droite)
- y: 0 (haut, ligne fond équipe extérieure) → 1 (bas, ligne fond équipe domicile)
- Filet : y = 0.5
- Ligne d'attaque domicile : y = 0.75
- Ligne d'attaque extérieure : y = 0.25

## Positions FIVB indoor (par rapport au court complet)

Domicile (bas, y: 0.5 → 1.0) :
- P1 arrière-droit  : x=0.83, y=0.85
- P2 avant-droit    : x=0.83, y=0.60
- P3 avant-centre   : x=0.50, y=0.60
- P4 avant-gauche   : x=0.17, y=0.60
- P5 arrière-gauche : x=0.17, y=0.85
- P6 arrière-centre : x=0.50, y=0.85

Extérieure (haut, y: 0.0 → 0.5, positions miroir) :
- P1 : x=0.17, y=0.15
- P2 : x=0.17, y=0.40
- P3 : x=0.50, y=0.40
- P4 : x=0.83, y=0.40
- P5 : x=0.83, y=0.15
- P6 : x=0.50, y=0.15

## Logique de drag

Mode move :
- Chaque PlayerToken gère son propre PanGesture (Reanimated)
- Translation stockée dans shared values (smooth visual)
- À la fin du drag : runOnJS(movePlayer)(id, newX, newY)
- Le GestureDetector du dessin est désactivé (enabled=false)

Mode dessin (arrow_solid / arrow_dashed / arrow_curved) :
- PlayerTokens non draggables (enabled=false)
- GestureDetector transparent overlay activé
- Preview arrow en React state (performance acceptable)
- À onEnd : finalizeArrow() → addArrow() dans le store

Mode gomme :
- Tap sur une flèche la supprime (removeArrow)
- Pas de gesture overlay actif

## Playback

Séquence requestAnimationFrame (JS thread) :
1. Snapshot des positions initiales
2. Pour chaque flèche triée par order :
   a. Trouver le joueur le plus proche de fromX/fromY
   b. Interpoler sa position vers toX/toY en 800ms/speed
   c. Attendre avec Promise avant la flèche suivante
3. Afficher Reset button

## Phases d'implémentation

### Phase 1 : Data layer
- [x] models/tactical.ts
- [x] features/tactical/positionUtils.ts
- [x] features/tactical/defaultPlays.ts
- [x] features/tactical/tacticalStore.ts
- [x] features/tactical/tacticalService.ts
- [x] Mise à jour database.ts (migration v2)

### Phase 2 : Tests (TDD)
- [x] __tests__/tactical-store.test.ts
- [x] __tests__/tactical-positions.test.ts
- [x] __tests__/tactical-default-plays.test.ts

### Phase 3 : Composants SVG/Court
- [x] CourtSVG.tsx
- [x] ArrowPath.tsx
- [x] ArrowOverlay.tsx

### Phase 4 : Interactions
- [x] PlayerToken.tsx (drag & drop)
- [x] ToolBar.tsx
- [x] PlaybackControls.tsx
- [x] PlaybookSheet.tsx

### Phase 5 : Assemblage
- [x] TacticalBoard.tsx
- [x] Integration referee.tsx
- [x] i18n fr+en

### Phase 6 : Commit
- feat: add tactical board with drag & drop and arrow drawing
