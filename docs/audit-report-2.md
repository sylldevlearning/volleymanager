# Audit Report #2 — VolleyManager

**Date** : 2026-05-08  
**Auditeur** : QA automatique (Claude)  
**Résultat final** : 0 erreur TypeScript · 142/142 tests ✅

---

## Résumé

| Sévérité | Trouvés | Corrigés |
|---|---|---|
| Critique | 4 | 4 |
| Haute | 2 | 2 |
| Moyenne | 5 | 5 |
| Basse | 3 | 3 |
| **Total** | **14** | **14** |

Aucun bug en suspens.

---

## Bugs détectés et corrigés

### BUG-012 : player-stats — conflit de nommage `setStats` entre useState setter et state Map

- **Fichier** : [app/match/[id]/player-stats/[playerId].tsx](../app/match/%5Bid%5D/player-stats/%5BplayerId%5D.tsx)
- **Sévérité** : Critique
- **Description** : Le fichier déclarait `const [stats, setStats]` (setter de `useState<PlayerMatchStats|null>`) puis immédiatement `const [setStats, setSetStats]` (state de type `Map`). TypeScript levait TS2451 (Cannot redeclare block-scoped variable 'setStats') et TS2339 sur `.keys()` et `.get()` appelés sur un `Dispatch`.
- **Cause** : Nom de variable identique choisi pour deux déclarations `useState` distinctes dans le même scope.
- **Fix** : Renommage de la state Map en `perSetStats` et son setter en `setPerSetStats`. Mise à jour des 3 usages dans la fonction de chargement et le rendu JSX.
- **Commit** : `fd8d844`

---

### BUG-013 : Jest config — `testPathPattern` n'est pas une option valide de jest.config

- **Fichier** : [package.json](../package.json)
- **Sévérité** : Moyenne
- **Description** : Le champ `"testPathPattern"` dans la configuration Jest de `package.json` générait un avertissement de validation à chaque exécution ("Unknown option testPathPattern"). Cette clé n'existe pas dans la configuration fichier — c'est un flag CLI uniquement.
- **Cause** : Confusion entre options CLI (`--testPathPattern`) et clés de configuration fichier.
- **Fix** : Remplacement par `"testRegex": ".*\\.test\\.(ts|tsx)$"` qui est l'équivalent valide en config fichier.
- **Commit** : `ed8683f`

---

### BUG-014 : Seeding — migration v3 court-circuitait le seedService

- **Fichiers** : [src/services/database.ts](../src/services/database.ts), [app/_layout.tsx](../app/_layout.tsx)
- **Sévérité** : Critique
- **Description** : La migration v3 insérait directement 2 équipes et 12 joueurs dans la DB. Comme `seedDefaultDataIfEmpty()` vérifie si des équipes existent avant d'agir, le seeding de la migration l'empêchait de s'exécuter. De plus, `seedDefaultDataIfEmpty()` n'était pas appelé au démarrage de l'app.
- **Cause** : La logique de seeding avait été dupliquée entre la migration et le seedService, et l'appel au seedService dans `_layout.tsx` n'avait pas été ajouté.
- **Fix** : Suppression de tout le code de seeding de la migration v3 (conservé uniquement le `PRAGMA user_version = 3`). Ajout de `seedDefaultDataIfEmpty().catch(() => {})` dans le `useEffect` de chargement des fonts dans `_layout.tsx`.
- **Commit** : `ed8683f`

---

### BUG-015 : coach.tsx — shadowing de la variable `t` (traduction) par une destructuration async

- **Fichier** : [app/match/[id]/coach.tsx](../app/match/%5Bid%5D/coach.tsx)
- **Sévérité** : Moyenne
- **Description** : La fonction `load()` déclarait `const [t, p] = await Promise.all(...)` pour récupérer l'équipe et les joueurs. Cette variable locale `t` masquait la fonction `t` de `useTranslation()` dans tout le scope de `load()`.
- **Cause** : Choix malheureux du nom de variable destructuré identique à l'alias `t` de i18n.
- **Fix** : Renommage de la variable en `tm` (team) : `const [tm, p] = await Promise.all(...)` et `setTeam(tm)`.
- **Commit** : `ed8683f`

---

### BUG-016 : summary.tsx — affichage "null null" pour les joueurs sans prénom/nom

- **Fichier** : [app/match/[id]/summary.tsx](../app/match/%5Bid%5D/summary.tsx)
- **Sévérité** : Haute
- **Description** : Le template `` `#{player.number} {player.firstName} {player.lastName}` `` rendait "#12 null null" pour les joueurs ayant uniquement un numéro (sans `firstName` ni `lastName` renseignés), car ces champs sont typés `string | null`.
- **Cause** : Accès direct aux champs nullables sans garde-fou.
- **Fix** : Remplacement par `getPlayerDisplayName(player)` du helper `player-helpers.ts` qui gère correctement les cas null.
- **Commit** : `ed8683f`

---

### BUG-017 : stats.tsx — import inutilisé `getPlayerShortName`

- **Fichier** : [app/match/[id]/stats.tsx](../app/match/%5Bid%5D/stats.tsx)
- **Sévérité** : Basse
- **Description** : `getPlayerShortName` était importé mais n'était référencé nulle part dans le fichier, générant un warning TypeScript d'import inutilisé.
- **Cause** : Import résiduel d'une refactorisation incomplète.
- **Fix** : Suppression de la ligne d'import.
- **Commit** : `ed8683f`

---

### BUG-018 : Écrans stats — double header (Expo Router défaut + header custom)

- **Fichier** : [app/_layout.tsx](../app/_layout.tsx)
- **Sévérité** : Haute
- **Description** : Les 3 nouveaux écrans de statistiques (`match/[id]/stats`, `match/[id]/player-stats/[playerId]`, `player/[id]/stats`) n'avaient pas d'entrée `Stack.Screen` dans le layout racine. Expo Router affichait donc son header par défaut au-dessus du header custom déjà présent dans chaque écran.
- **Cause** : Oubli d'ajouter les déclarations `Stack.Screen` lors de la création de ces écrans.
- **Fix** : Ajout de 3 entrées `Stack.Screen` avec `headerShown: false` dans `RootLayoutNav`.
- **Commit** : `ed8683f`

---

### BUG-019 : referee.tsx — 5 chaînes françaises codées en dur

- **Fichiers** : [app/match/[id]/referee.tsx](../app/match/%5Bid%5D/referee.tsx), [src/i18n/fr.json](../src/i18n/fr.json), [src/i18n/en.json](../src/i18n/en.json)
- **Sévérité** : Moyenne
- **Description** : 5 chaînes de caractères étaient codées en dur en français dans l'écran arbitre : le message de victoire d'équipe, le libellé "Set suivant", le message d'absence de temps mort, le titre du dialogue de temps mort, et le score des sets en sous-titre.
- **Cause** : Chaînes oubliées lors de la passe i18n initiale.
- **Fix** : Ajout des clés `referee.winsMatch`, `referee.nextSet`, `referee.noTimeoutsLeft`, `referee.timeoutFor`, `referee.setsScore` dans `fr.json` et `en.json`. Remplacement des chaînes littérales par les appels `t()` correspondants.
- **Commits** : `ed8683f`, `ffa307a`

---

### BUG-020 : team/[id].tsx — 2 chaînes françaises codées en dur

- **Fichiers** : [app/team/[id].tsx](../app/team/%5Bid%5D.tsx), [src/i18n/fr.json](../src/i18n/fr.json), [src/i18n/en.json](../src/i18n/en.json)
- **Sévérité** : Basse
- **Description** : Le message de pluralisation "{n} ajouté{s}" et le message de confirmation de suppression d'équipe étaient codés en dur en français.
- **Cause** : Chaînes oubliées lors de la passe i18n initiale.
- **Fix** : Ajout des clés `player.addedCount` / `player.addedCount_other` et `team.deleteConfirm` dans les deux fichiers de traduction. Remplacement des chaînes par `t('player.addedCount', { count })` et `t('team.deleteConfirm', { name })`.
- **Commit** : `ed8683f`

---

### BUG-021 : coach.tsx — les stats se réinitialisaient lors du premier enregistrement

- **Fichier** : [app/match/[id]/coach.tsx](../app/match/%5Bid%5D/coach.tsx)
- **Sévérité** : Critique
- **Description** : `eventsBuffer` était initialisé à `[]` à chaque montage du composant. Dès le premier appui sur un bouton de stat, `computePlayerStats([newEvent])` écrasait toutes les stats déjà accumulées en sessions précédentes — un entraîneur quittant et revenant sur l'écran perdait tout l'historique.
- **Cause** : Le buffer local n'était pas hydraté depuis la base de données au montage.
- **Fix** : Chargement des événements existants via `getEventsForMatch(id)` dans `load()` et initialisation de `eventsBuffer` avec ces événements. `setStats(computePlayerStats(existingEvents))` recalcule les stats initiales correctement.
- **Commit** : `d5d4e07`

---

### BUG-022 : player.ts — fonction morte `playerDisplayName` jamais utilisée

- **Fichier** : [src/models/player.ts](../src/models/player.ts)
- **Sévérité** : Basse
- **Description** : Une fonction `playerDisplayName(player)` était exportée depuis le modèle mais n'était importée nulle part dans le codebase. Elle coexistait avec `getPlayerDisplayName` dans `player-helpers.ts` (l'implémentation réellement utilisée) avec une sémantique légèrement différente.
- **Cause** : Vestige d'une refactorisation où la fonction a été déplacée dans un helper sans nettoyer l'original.
- **Fix** : Suppression de la fonction morte du fichier modèle.
- **Commit** : `d5d4e07`

---

### BUG-023 : statsService.ts — constante morte `FAULT_TYPES` jamais référencée

- **Fichier** : [src/services/statsService.ts](../src/services/statsService.ts)
- **Sévérité** : Basse
- **Description** : `const FAULT_TYPES = new Set([...])` était déclarée dans le service mais jamais utilisée dans aucun calcul ou condition.
- **Cause** : Vestige d'une implémentation abandonnée au profit d'une logique différente.
- **Fix** : Suppression de la constante inutilisée.
- **Commit** : `9640931`

---

### BUG-024 : Préférence de langue perdue au redémarrage de l'app

- **Fichier** : [app/_layout.tsx](../app/_layout.tsx)
- **Sévérité** : Moyenne
- **Description** : La langue choisie par l'utilisateur dans les Settings (stockée dans `settingsStore` via Zustand persist) n'était jamais appliquée à i18n au démarrage. L'app repartait toujours en français (langue de détection système ou défaut), ignorant la préférence sauvegardée.
- **Cause** : `i18n` était importé uniquement pour ses effets de bord (`import '../src/i18n'`) sans jamais appeler `i18n.changeLanguage()` avec la valeur du store.
- **Fix** : Import nommé `import i18n from '../src/i18n'` et ajout d'un `useEffect` dans `RootLayoutNav` qui appelle `i18n.changeLanguage(language)` dès que la valeur `language` du store change (y compris au premier rendu).
- **Commit** : `b34ce6e`

---

### BUG-025 : Tableau tactique — crash natif silencieux au drag d'un jeton (Exclusive ordering + maxDistance)

- **Fichier** : [src/components/tactical/PlayerToken.tsx](../src/components/tactical/PlayerToken.tsx)
- **Sévérité** : Critique
- **Description** : L'app se fermait immédiatement sans message d'erreur dès qu'un jeton joueur était glissé sur le terrain. Le crash était un crash natif silencieux dans le système de gesture de RNGH 2.28.
- **Cause** : Double problème de configuration des gestes :
  1. `Gesture.Exclusive(tapGesture, panGesture)` avec **Tap en premier** : Tap entrait en état `began` dès le touch-down et bloquait Pan (une seule gesture active dans Exclusive).
  2. `Gesture.Tap()` sans `.maxDistance()` : Tap ne se cancellait jamais sur le mouvement du doigt. Il restait `began` pendant les 200ms de `maxDuration`, bloquant Pan tout ce temps.
  3. `Gesture.Pan()` sans `.minDistance()` : Sans seuil de déplacement minimal, la distinction tap/drag était entièrement à la charge du `Exclusive`, qui était mal configuré.
  
  Résultat : après 200ms, Tap échouait et RNGH 2.28 tentait une "late activation" de Pan sur des events déjà traités → crash natif (pas d'error overlay React Native, app fermée directement).
- **Fix** :
  - Ajout de `.maxDistance(10)` sur `Gesture.Tap()` → Tap échoue immédiatement si le doigt dépasse 10px.
  - Ajout de `.minDistance(10)` sur `Gesture.Pan()` → Pan n'active qu'à partir de 10px de mouvement.
  - Inversion de l'ordre : `Gesture.Exclusive(panGesture, tapGesture)` → Pan a la priorité, s'active en moins de 200ms si le doigt bouge suffisamment, et Tap ne s'active que pour les touches courtes sans déplacement.
- **Commit** : `fix: tactical board drag crash — Exclusive ordering + missing minDistance/maxDistance`

---

## Vérification finale

```
npx tsc --noEmit   → 0 erreurs
npm test           → 142/142 tests ✅
i18n parity FR↔EN  → OK (toutes clés présentes dans les deux fichiers)
```
