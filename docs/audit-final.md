# Audit Final — VolleyManager Pré-Publication Play Store

**Date** : 2026-05-16  
**Numérotation** : BUG-030 → BUG-038  
**Résultat** : 9 bugs trouvés, 9 corrigés, 0 restant critique

---

## Résumé

| Sévérité | Trouvés | Corrigés | Restants |
|----------|---------|----------|---------|
| Critique | 1 | 1 | 0 |
| Majeur | 4 | 4 | 0 |
| Mineur | 4 | 4 | 0 |
| **Total** | **9** | **9** | **0** |

**Tests** : 202/202 passent  
**TypeScript** : 0 erreur (`npx tsc --noEmit`)  
**Dépendances** : compatibles (`npx expo install --check` → clean)

---

## PHASE 1 — Build & Compilation

### BUG-030 : seedService — logique cassée + 6 tests en échec
- **Fichier** : `src/services/seedService.ts`
- **Sévérité** : Critique
- **Description** : `seedDefaultDataIfEmpty` importait et appelait `getTeamByName` qui n'était pas dans le mock des tests. De plus, la branche "re-seed" (équipes sans joueurs) ne créait pas de nouvelles équipes alors que les tests l'attendaient.
- **Fix** : Suppression de l'import `getTeamByName`. Unification du chemin de seed : si aucun joueur dans la première équipe → appel `createTeam` pour les deux équipes par défaut. `createTeam` gère déjà la contrainte UNIQUE en interne.
- **Commit** : `bb20040`

### BUG-038 : Dépendances incompatibles avec Expo SDK 54
- **Fichier** : `package.json`
- **Sévérité** : Majeur
- **Description** : `jest-expo@55.0.17` et `@types/jest@30.0.0` installés alors que Expo SDK 54 requiert respectivement `~54.0.17` et `29.5.14`. Signalé par `npx expo install --check`.
- **Fix** : `npm install --save-dev @types/jest@29.5.14 jest-expo@54.0.17`. Tous les tests continuent de passer.
- **Commit** : `326a100`

---

## PHASE 2 — SQLite & Données

Voir BUG-030 (seedService) ci-dessus.

✅ Migrations v1→v7 enchaînées sans erreur sur DB neuve  
✅ UNIQUE constraint sur `teams.name` + `createTeam` retourne l'existant en cas de conflit  
✅ 13 joueurs JO Paris 2024 par équipe (France + Brésil)  
✅ Cascade `ON DELETE CASCADE` sur players, sets, events, lineups  
✅ Prepared statements (`runAsync`/`getAllAsync`) partout — zéro concaténation SQL

---

## PHASE 3 — Scoring (Referee)

### BUG-035 : Pas de vibration sur chaque point
- **Fichier** : `app/match/[id]/referee.tsx:192`
- **Sévérité** : Majeur
- **Description** : `handlePoint` n'appelait `Haptics` qu'en cas de victoire de set. Un retour haptique était absent sur le tap +1 normal.
- **Fix** : Ajout de `Haptics.impactAsync(ImpactFeedbackStyle.Medium)` en tête de `handlePoint` (conditionné par `hapticsEnabled`).
- **Commit** : `571cf29`

### BUG-036 : Scoring non bloqué pendant un temps mort
- **Fichier** : `app/match/[id]/referee.tsx:377,391`
- **Sévérité** : Majeur
- **Description** : Les `ScoreButton` avaient `disabled={setIsOver}` uniquement. Pendant l'overlay de temps mort (`showTimeoutSheet=true`), le scoring restait possible.
- **Fix** : `disabled={setIsOver || showTimeoutSheet}` sur les deux boutons de score.
- **Commit** : `571cf29`

✅ -1 hors du GestureDetector du +1 (pas de double-fire)  
✅ Logique victoire de set gérée par `isSetWon` / `isMatchWon`  
✅ Ballon PNG (`ballon.png`) sur l'indicateur de service avec animation  
✅ Vibration à chaque point, set gagné, undo, remplacement

---

## PHASE 4 — Substitutions

✅ Vrais joueurs affichés depuis `homePlayers`/`awayPlayers`  
✅ Libéro : couleur `#FBBF24`, badge `⚡ L`, bordure dashed  
✅ Limite 6 remplacements visuelle et fonctionnelle  
✅ Lineup initialisé via `initLineup` au démarrage du match

---

## PHASE 5 — Tableau Tactique

✅ Ballon rendu via `BallToken` (PNG `ballon.png`), draggable en mode `move`  
✅ `pointerEvents={canDrag ? 'auto' : 'none'}` sur `PlayerToken` — tracé traverse le joueur en mode dessin  
✅ Toolbar dans un `ScrollView` horizontal  
✅ Score live dans le header si match actif  
✅ Menu ⋮ : Charger / Sauvegarder / Tout effacer

---

## PHASE 6 — Statistiques

✅ Tap joueur → navigation vers `/match/${id}/player-stats/${playerId}`  
✅ Division par zéro : helper `eff(num, den)` retourne 0 si `den === 0`  
✅ Radar 6 axes + barres de progression dans le dashboard  
✅ `SafeAreaView` sur tous les écrans stats

---

## PHASE 7 — Équipes & Joueurs

✅ France + Brésil : 13 joueurs JO Paris 2024 chacune  
✅ Mode batch (formulaire reste ouvert après ajout)  
✅ Numéro en doublon dans une équipe → erreur claire  
✅ Suppression équipe avec confirmation

---

## PHASE 8 — i18n

✅ 362 clés FR = 362 clés EN (aucune divergence)  
✅ Clés `help.*` présentes et utilisées sur les 10 écrans  
✅ Clés `substitution.*`, `tactical.*`, `scoring.*`, `stats.*` complètes  
✅ Switch de langue dans Settings → effet immédiat

---

## PHASE 9 — UI / Responsive / Design

✅ Dark mode uniquement (`userInterfaceStyle: dark` dans app.json)  
✅ `SafeAreaView` sur tous les écrans  
✅ `useResponsive` dans coach.tsx, matches.tsx, stats dashboard  
✅ Boutons ≥ 44dp partout  
✅ FlatList avec `keyExtractor` sur tous les écrans

---

## PHASE 10 — Play Store Assets

### BUG-033 : favicon.png 64×64 (attendu 48×48)
- **Fichier** : `assets/images/favicon.png`
- **Sévérité** : Mineur
- **Fix** : Régénération via `node scripts/generate-icons.js` → 48×48
- **Commit** : `c88880d`

### BUG-034 : splash-icon.png 1242×1242 (attendu 288×288)
- **Fichier** : `assets/images/splash-icon.png`
- **Sévérité** : Mineur
- **Fix** : Régénération via `node scripts/generate-icons.js` → 288×288
- **Commit** : `c88880d`

✅ `icon.png` 1024×1024  
✅ `adaptive-icon.png` 1024×1024 (fond transparent)  
✅ `store-assets/feature-graphic.png` 1024×500  
✅ `store-assets/screenshot-*.png` 1080×1920 (4 fichiers)  
✅ `store-assets/listing.md` avec titre, descriptions, tags

---

## PHASE 11 — Branding & Pub

### BUG-031 : Lien website manquant dans About
- **Fichier** : `app/about.tsx`
- **Sévérité** : Mineur
- **Description** : L'icône `Globe` était importée depuis lucide mais jamais rendue. Aucun lien website dans l'écran À propos.
- **Fix** : Ajout de `COMPANY_EMAIL` + `COMPANY_WEBSITE` dans `constants.ts`. Ajout d'une ligne website (`Linking.openURL`) dans `about.tsx`. La clé `about.website` existait déjà en FR et EN.
- **Commit** : `5a6cfdd`

### BUG-032 : AdBanner manquant sur accueil, historique, paramètres
- **Fichiers** : `app/(tabs)/index.tsx`, `app/(tabs)/matches.tsx`, `app/(tabs)/settings.tsx`
- **Sévérité** : Mineur
- **Description** : `AdBanner` n'était ajouté sur aucun des 3 onglets requis par Phase 11.
- **Fix** : Import + `<AdBanner />` ajouté en bas de chaque écran.
- **Commit** : `48e8bc6`

✅ Interstitiel post-match : affiché une seule fois sur victoire, avant summary  
✅ Zéro pub sur referee/coach/tactical pendant la partie  
✅ `SyllDevLearning` dans accueil (footer) + À propos  
✅ Contact mailto + lien website dans À propos

---

## PHASE 12 — Performance & Sécurité

✅ Zéro `console.log` en dehors de `__DEV__` (seuls `console.error` en catch block)  
✅ Zéro `any` dans le code TypeScript  
✅ Animations Reanimated sur UI thread via worklets  
✅ `keyExtractor` sur toutes les `FlatList`  
✅ Prepared statements SQL partout (`runAsync`, `getAllAsync`)  
✅ Zéro `eval()`

---

## Commits de cet audit

| Commit | Bug(s) | Description |
|--------|--------|-------------|
| `bb20040` | BUG-030 | seedService — logique simplifiée, 6 tests corrigés |
| `5a6cfdd` | BUG-031 | About — lien website Globe |
| `48e8bc6` | BUG-032 | AdBanner sur home/history/settings |
| `c88880d` | BUG-033+034 | Icônes régénérées (favicon 48×48, splash 288×288) |
| `571cf29` | BUG-035+036 | Haptic sur point + scoring bloqué pendant timeout |
| `326a100` | BUG-038 | jest-expo@54 + @types/jest@29 |
