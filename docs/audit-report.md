# Audit Report — VolleyManager

**Date** : 2026-05-07  
**Auditeur** : QA automatique (Claude)  
**Résultat final** : 0 erreur TypeScript · 99/99 tests ✅

---

## Résumé

| Sévérité | Trouvés | Corrigés |
|---|---|---|
| Critique | 4 | 4 |
| Haute | 1 | 1 |
| Moyenne | 6 | 6 |
| Basse | 1 | 1 |
| **Total** | **12** | **12** |

Aucun bug en suspens. Tous les bugs nécessitent une décision produit ? Non.

---

## Bugs détectés et corrigés

### BUG-012 : Crash au drag d'un joueur sur Expo Go — clamp() non déclarée worklet
- **Fichier** : [src/features/tactical/positionUtils.ts](../src/features/tactical/positionUtils.ts)
- **Sévérité** : Critique
- **Description** : L'app se fermait brutalement dès qu'on commençait à déplacer un jeton joueur sur le Tableau Tactique. Le crash était silencieux (pas de Red Box).
- **Cause** : `clamp()` était appelée depuis les callbacks `.onEnd()` de `Gesture.Pan()` dans `PlayerToken.tsx` et `TacticalBoard.tsx`. Ces callbacks s'exécutent sur le **thread UI** (worklet Reanimated). Appeler une fonction JS normale (non-worklet) depuis un worklet est un crash garanti sur Expo Go. `clamp` n'avait pas la directive `'worklet';`.
- **Fix** : Ajout de `'worklet';` en première ligne du corps de `clamp()`. `easeInOut` et `findNearestPlayer` ne sont appelées que depuis le thread JS (requestAnimationFrame) et ne nécessitent pas la directive.
- **Commit** : `5dbe3ef fix: tactical board drag crash on Expo Go — clamp() missing worklet directive`

---

### BUG-001 : computeTimeoutsUsed — logique d'identification du type cassée
- **Fichier** : [src/services/eventService.ts](../src/services/eventService.ts)
- **Sévérité** : Critique
- **Description** : La fonction comparait `teamId` avec `events[0]?.teamId` (l'équipe du *premier* événement dans la liste, qui peut être n'importe quoi) pour décider si l'event était `timeout_home` ou `timeout_away`. Cette heuristique donnait systématiquement un résultat aléatoire/erroné.
- **Cause** : Mauvaise heuristique — `events[0]?.teamId` n'a aucun rapport avec le `teamId` passé en paramètre.
- **Fix** : Filtrer directement `e.teamId === teamId` combiné au type d'event timeout.
- **Commit** : `8466c5d fix: computeTimeoutsUsed used wrong heuristic to determine timeout type`

---

### BUG-002 : Reprise d'un match en cours — création d'un set 1 dupliqué
- **Fichier** : [app/match/[id]/referee.tsx](../app/match/[id]/referee.tsx)
- **Sévérité** : Critique
- **Description** : Quand un match avait déjà le statut `live` (ex : retour sur l'écran arbitre), le code créait un *nouveau* set 1 dans la base de données au lieu de charger les sets existants, corrompant l'historique et perdant tous les scores déjà joués.
- **Cause** : La branche `else` du `if (m.status === 'created')` appelait `createSet(id, 1)` inconditionnellement.
- **Fix** : Chargement des sets existants via `getSetsForMatch()`, sélection du dernier set non terminé. Création d'un set uniquement si aucun set n'existe (cas impossible mais gardé en fallback).
- **Commit** : `0bf754e fix: resuming a live match created a duplicate set 1 in DB`

---

### BUG-003 : Mode Entraîneur — les stats ne pouvaient jamais être enregistrées
- **Fichier** : [app/match/[id]/coach.tsx](../app/match/[id]/coach.tsx)
- **Sévérité** : Critique
- **Description** : `currentSetId` était initialisé à `''` et n'était jamais rempli. `handleStat()` retournait immédiatement (`if (!currentSetId) return`), rendant l'intégralité de l'écran entraîneur non fonctionnel. Un bandeau d'avertissement "Entrez l'ID du set actif" confirmait le problème côté UI.
- **Cause** : Oubli d'implémenter le chargement du set actif au montage du composant.
- **Fix** : Chargement des sets via `getSetsForMatch()` au montage, sélection automatique du dernier set non terminé. Suppression du bandeau d'avertissement devenu inutile. Typage de `eventsBuffer` en `MatchEvent[]` au lieu de `any[]`.
- **Commit** : `9bca25b fix: coach screen could never record stats (currentSetId always empty)`

---

### BUG-004 : PlaybookSheet — catégorie non restaurée lors de l'édition d'un schéma
- **Fichier** : [src/components/tactical/PlaybookSheet.tsx](../src/components/tactical/PlaybookSheet.tsx)
- **Sévérité** : Haute
- **Description** : En mode édition (`saveMode = 'update'`), la catégorie du schéma n'était jamais restaurée. `plays.find(p => p.id === currentPlayId)` s'exécutait de manière synchrone avant que `getAllPlays()` (asynchrone) ait eu le temps de remplir `plays[]`, retournant toujours `undefined`.
- **Cause** : Race condition classique : lecture d'un état React avant qu'une promesse l'ait mis à jour.
- **Fix** : Déplacement du `setSaveCategory` dans le callback `.then()` de `getAllPlays()`, où `loadedPlays` contient les données fraîchement chargées.
- **Commit** : `6df4c86 fix: playbook edit mode lost play category (async race condition)`

---

### BUG-005 : coach.tsx — type `any[]` pour eventsBuffer
- **Fichier** : [app/match/[id]/coach.tsx](../app/match/[id]/coach.tsx)
- **Sévérité** : Moyenne
- **Description** : `useState<any[]>([])` pour `eventsBuffer` désactivait la vérification de type sur tous les accès à ce tableau.
- **Cause** : Type placeholder non corrigé.
- **Fix** : Remplacé par `useState<MatchEvent[]>([])` avec l'import correspondant.
- **Commit** : inclus dans `9bca25b`

---

### BUG-006 : match/new.tsx — message d'erreur équipes identiques codé en français
- **Fichier** : [app/match/new.tsx](../app/match/new.tsx)
- **Sévérité** : Moyenne
- **Description** : `'Les deux équipes doivent être différentes.'` était une chaîne littérale, non traduite.
- **Fix** : Clé `match.differentTeams` ajoutée à fr.json et en.json, `t('match.differentTeams')` utilisé dans le code.
- **Commit** : `241638a fix: replace hardcoded French strings with i18n keys`

---

### BUG-007 : match/new.tsx — TeamPicker appelait `t()` sans avoir `useTranslation()`
- **Fichier** : [app/match/new.tsx](../app/match/new.tsx)
- **Sévérité** : Moyenne
- **Description** : `TeamPicker` est une fonction composant standalone, pas une closure de `NewMatchScreen`. Elle appelait `t('match.noTeamsHint')` sans que `t` soit dans son scope — crash runtime garanti.
- **Cause** : Refactoring partiel oubliant d'ajouter `useTranslation()` au composant.
- **Fix** : Ajout de `const { t } = useTranslation()` dans `TeamPicker`, et clé `match.noTeamsHint` dans les deux fichiers de traduction.
- **Commit** : `241638a fix: replace hardcoded French strings with i18n keys`

---

### BUG-008 : team/new.tsx — message "Le nom est requis" codé en français
- **Fichier** : [app/team/new.tsx](../app/team/new.tsx)
- **Sévérité** : Moyenne
- **Description** : `Alert.alert(t('common.error'), 'Le nom est requis.')` — chaîne littérale non traduite.
- **Fix** : Clé `team.nameRequired` dans fr.json/en.json, `t('team.nameRequired')` dans le code.
- **Commit** : `241638a fix: replace hardcoded French strings with i18n keys`

---

### BUG-009 : team/[id].tsx — liste vide joueurs codée en français
- **Fichier** : [app/team/[id].tsx](../app/team/[id].tsx)
- **Sévérité** : Moyenne
- **Description** : `'Aucun joueur — ajoutez des joueurs'` — chaîne littérale non traduite.
- **Fix** : Clé `team.noPlayers` dans fr.json/en.json, `t('team.noPlayers')` dans le code.
- **Commit** : `241638a fix: replace hardcoded French strings with i18n keys`

---

### BUG-010 : PlaybookSheet — "flèche/flèches" codé en français
- **Fichier** : [src/components/tactical/PlaybookSheet.tsx](../src/components/tactical/PlaybookSheet.tsx)
- **Sévérité** : Moyenne
- **Description** : `{play.arrows.length} flèche{play.arrows.length !== 1 ? 's' : ''}` — pluriel codé en dur en français.
- **Fix** : Clés `tactical.arrows_one` / `tactical.arrows_other` dans les deux locales, ternaire `t('tactical.arrows_one') : t('tactical.arrows_other')` dans le composant.
- **Commit** : `241638a fix: replace hardcoded French strings with i18n keys`

---

### BUG-011 : volleyball-rules.ts — commentaire de rotation contradictoire
- **Fichier** : [src/utils/volleyball-rules.ts](../src/utils/volleyball-rules.ts)
- **Sévérité** : Basse
- **Description** : Deux commentaires adjacents décrivaient la rotation dans deux sens opposés : `"P1→P6→P5→P4→P3→P2→P1"` (ordre de service) puis `"P1→P2, P2→P3..."` (sens du tableau), sans expliquer que ce sont deux notions différentes. Très trompeur pour tout développeur lisant le code.
- **Fix** : Remplacement par un commentaire unique et cohérent expliquant les deux notions.
- **Commit** : `a73a349 fix: correct misleading rotation comment in volleyball-rules.ts`

---

## Points non bloquants vérifiés (pas de bug)

- **Rotation FIVB** : direction correcte (`p === 6 ? 1 : p + 1` = P6→P1 = le joueur en P6 passe en P1 et sert). ✅
- **Règles FIVB indoor** : 25 pts, 2 pts d'écart, 5e set à 15 pts — ✅
- **Règles beach** : 21 pts, 3e set à 15, changement de côté tous les 7 pts (5 au décisif) — ✅
- **Side-out rotation** : déclenchée uniquement quand l'équipe qui marque récupère le service — ✅
- **Event-sourcing** : undo = `is_cancelled=1`, score recalculé depuis les events actifs — ✅
- **AsyncStorage** : clé unique `@volleymanager/tactical_plays`, pas de collision — ✅
- **Foreign keys DB** : `ON DELETE CASCADE` sur players→team, events→match/set — ✅
- **SQLite prepared statements** : toutes les requêtes paramétrées via `?` — ✅
- **FlatList avec keyExtractor** : présent partout — ✅
- **App offline** : aucun appel réseau — ✅

---

## Verdict final

```
npx tsc --noEmit  →  0 erreur
npm test          →  99/99 tests passent
```
