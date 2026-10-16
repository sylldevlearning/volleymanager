# Plan Phase 6 — Section Arbitrage (FIVB indoor / FFVolley)

> **Note (mise à jour)** : ce plan a été écrit pour un arbitrage adossé aux
> **équipes enregistrées** (alignement via `lineup.tsx`, capitaine choisi
> avant le set 1, etc.). En cours de réalisation, la décision a été prise de
> rendre le mode arbitrage **entièrement autonome** : équipes et joueurs
> saisis à la volée, jamais ajoutés à la bibliothèque d'équipes (voir
> `app/arbitrage/new.tsx`, `src/services/adHocMatchService.ts`,
> `teams.is_ad_hoc`). Les sections ci-dessous ont été réécrites pour refléter
> l'état réel du code ; les parties du plan original devenues obsolètes sont
> marquées **(obsolète)**.

## Objectif
Écran d'arbitrage FIVB indoor pour un match **autonome** (`app/match/[id]/arbitrage.tsx`),
distinct de `referee.tsx` (reste l'outil de scorage/stats coach pour les
équipes enregistrées). Réutilise le store, les services et le schéma
event-sourcing existants. Toute action illégale au regard des règles
FIVB/FFVolley est **bloquée** avec un message court et explicite.

## Décisions validées
- Point d'entrée : bouton **"Arbitrage"** sur l'accueil (pas sur les cartes
  de match — retiré de `matches.tsx`), avec reprise d'un match en cours /
  nouveau match (confirmation d'abandon).
- Équipes et joueurs saisis librement (`arbitrage/new.tsx`), jamais ajoutés
  aux équipes enregistrées (`teams.is_ad_hoc`).
- Alignement I-VI, substitutions, service, capitaine, etc. gérés **directement
  sur le terrain** de `arbitrage.tsx` — pas d'écrans modaux séparés
  (`ServeChoiceModal`/`PreSetLineupSheet`/`CaptainPicker` du plan original
  n'existent pas comme composants distincts ; leur logique est inlinée dans
  `arbitrage.tsx`).
- Support complet de 2 libéros par équipe : un seul actif sur le terrain à la
  fois, pas d'échange direct L1 ↔ L2 (doit repasser par le joueur remplacé).
- Les règles sont centralisées dans un module pur et testable
  `src/utils/rulesValidator.ts` — un test par règle (voir §7).
- Persistance/reprise : tant que le match n'est pas terminé, l'arbitre peut
  fermer l'app et retrouver le match exactement dans le même état (score,
  alignement, rotation, service, libéros, capitaine en jeu, remplacements,
  temps morts, côtés inversés) — voir `src/services/matchStateReconstruction.ts`.

---

## 1. Modèle de données — état réel

| Élément | Statut |
|---|---|
| `matches.captain_home_id` / `captain_away_id` | ✅ fait (migration v10) |
| `sets.serving_team_id` | ✅ fait (migration v10), **et réellement consulté** par `determineInitialServing` (sinon le choix manuel de service n'avait aucun effet — bug corrigé) |
| `substitution_pairs.is_exceptional` | ✅ fait (migration v9) |
| `matchService.setMatchCaptains` | ✅ fait |
| `matchService.setFirstServeTeam` | ✅ fait — persiste qui a servi en premier au set 1, base de l'alternance auto-résolue des sets 2-4 |
| `matches.sides_swapped`, `acting_captain_home_id/away_id` | ✅ fait (migration v12) — état écran référé non dérivable des events |
| `lineupService.saveLineup` / `getLineupForSet` | ✅ fait — persisté **avant chaque set** (pas seulement le 1er) |
| `substitutionService.getPairsForMatch` | ✅ fait |
| Libéro — `position: 'libero'` filtrable (0 à 2) | ✅ fait — `SubstitutionSheet` affiche tous les libéros du banc (chips), pas de champs `liberosHome/Away` dédiés dans le store (filtrage direct du banc, plus simple, même résultat) |
| Sanctions — `sanction_home/away`, `sanctionRules.ts`, `sanctionService.ts` | ✅ fait, **et branché dans l'UI** (`SanctionSheet.tsx`, bouton "Carton" par équipe) |
| Undo cascade sanction + point lié | ✅ fait (`eventService.undoLastEvent`) |

---

## 2. Validation stricte des règles — `src/utils/rulesValidator.ts`

Entièrement implémenté comme prévu : tous les codes (`sub_quota_reached`,
`sub_starter_already_returned`, `sub_wrong_return`, `sub_reserve_already_used`,
`sub_player_on_court`, `sub_player_expelled`, `sub_player_disqualified`,
`sub_libero_not_allowed`, `libero_front_row`, `libero_rally_required`,
`timeout_quota_reached`, + `libero_other_active` en plus du plan original),
chacun avec son message FR exact et testé (`rulesValidator.test.ts`).

`SubstitutionSheet.tsx` (mode `strict`, utilisé par l'écran d'arbitrage)
appelle ce module avec les **vraies** `sanctionEventsForSet`/`sanctionEventsForMatch`
(chargées via `sanctionService.getSanctionsForMatch`, rafraîchies après chaque
sanction et après chaque `undo`) — les tableaux vides codés en dur ont été
supprimés : `sub_player_expelled`/`sub_player_disqualified` peuvent désormais
réellement se déclencher.

`getExceptionalSubstitutionEligibility` est maintenant **branché** dans
`SubstitutionSheet.tsx` : quand le joueur sortant ne peut être remplacé
légalement par aucun candidat du banc, les lignes normalement bloquées
deviennent sélectionnables et le bouton de confirmation devient
**"Remplacement exceptionnel"** (couleur distincte). Le remplacement est
marqué `isExceptional: true` sur la paire + l'event.

Libéro §2.1 à §2.4 (entrée zone arrière, rally requis, sortie auto via
rotation, sortie manuelle) : tout est fait, avec `rotateSideOnSideOut`
(`src/utils/courtRotation.ts`) comme **source unique** de la logique de
rotation/sortie-auto, partagée par le store live et la reconstruction DB.

---

## 3. Règles FIVB nouvelles (`src/utils/volleyball-rules.ts`)

`shouldChangeEndsIndoor` — fait, code identique au plan original, testé.
Contrairement au plan, le changement de côté n'est **pas automatique** :
une alerte s'affiche et c'est l'arbitre qui appuie sur les flèches ⇄
(décision prise après tests sur le terrain). Pas de composant
`ChangeEndsModal.tsx` dédié — `Alert.alert` inline, dupliqué si besoin futur
entre écrans (pas de duplication actuelle : `referee.tsx` n'a pas cette
fonctionnalité pour l'indoor).

---

## 4. Composants (`src/components/arbitrage/`) — état réel

| Composant du plan original | Statut |
|---|---|
| `ServeChoiceModal.tsx` | **(obsolète)** — inlinée (`ServeChoiceView`, fonction locale de `arbitrage.tsx`), réutilisée avant le set 1 **et** avant le set 5 (choix manuel comme au set 1) |
| `PreSetLineupSheet.tsx` | **(obsolète)** — l'alignement se fait directement sur le terrain de `arbitrage.tsx` (`lineupSetupMode`), **avant chaque set (1 à 5)**, pré-rempli avec l'alignement du set précédent et modifiable |
| `SanctionSheet.tsx` | ✅ fait — cible joueur (sur le terrain + banc) ou "Staff / Entraîneur", type (avertissement/pénalité/expulsion/disqualification/retard de jeu), branché sur `sanctionService.addSanction` |
| `SetBreakSheet.tsx` | ❌ pas fait — pas de pause chronométrée de 3 min entre les sets (juste une alerte "changement de côté") |
| `CaptainPicker.tsx` | **(obsolète pour les équipes enregistrées, fait différemment en autonome)** — le capitaine est choisi à la création du match ad-hoc (`arbitrage/new.tsx`) ; en jeu, un **capitaine en jeu** (stand-in) est désigné automatiquement via des modales inlinées quand le capitaine titulaire sort du terrain |
| `EventHistoryList.tsx` | ❌ pas fait — pas d'historique chronologique point par point ; `SubstitutionRecapSheet.tsx` existe mais ne couvre que les remplacements |
| `RuleViolationToast.tsx` | **(obsolète)** — `Alert.alert` utilisé directement |

### Extraction partagée
`src/features/lineup/lineupBuilder.ts` — ❌ pas fait. `lineup.tsx` (équipes
enregistrées) reste inchangé et indépendant ; `arbitrage.tsx` a sa propre
logique de lineup (`buildLineupState`, `toLineupEntries`), volontairement
non partagée puisque les deux écrans ciblent des modèles différents
(enregistré vs ad-hoc).

---

## 5. Service PDF — **non fait**

`src/services/matchSheetService.ts` n'existe pas. Aucune dépendance
`expo-print`/`expo-sharing` installée. Pas de bouton d'export sur
`summary.tsx`. Reste entièrement à faire si besoin (hors scope de cette
itération).

---

## 6. Écrans — état réel

```
app/match/[id]/
  arbitrage.tsx          FAIT — écran principal d'arbitrage autonome
  lineup.tsx             existant, inchangé (équipes enregistrées, 1er alignement)
  referee.tsx            existant, inchangé
  coach.tsx               existant, inchangé
  summary.tsx             existant, INCHANGÉ (pas de bouton PDF, pas d'historique — voir §5/§4)
app/arbitrage/
  new.tsx                 FAIT — configuration autonome (équipes, règles, capitaine)
app/(tabs)/index.tsx      bouton "Arbitrage" avec reprise/nouveau match
```

### `arbitrage.tsx` — flux réel
1. **Nouveau match** (`match.status === 'created'`) : choix manuel du service
   (set 1) → alignement I-VI directement sur le terrain (home puis away) →
   écran de score.
2. **Pendant le set** : score, indicateur de service animé, temps morts
   (`TimeoutTimerSheet`, persistés en event, annulables), remplacements
   (`SubstitutionSheet` strict, avec remplacement exceptionnel), **bouton
   "Carton" par équipe → `SanctionSheet`**, bouton "Récap remplacements",
   bouton "Annuler" (générique, cascade sanction+point). Alerte changement
   de côté à 8 pts au 5e set (indoor), flèches ⇄ manuelles. Tap sur le
   libéro en jeu → sortie manuelle ; sortie automatique silencieuse +
   événement enregistré. Capitaine en jeu marqué visuellement, picker
   automatique quand le titulaire sort.
3. **Fin de set** : alignement I-VI **redemandé** pour le set suivant
   (2 à 4 : service auto-résolu puis alignement ; **5 : choix manuel du
   service comme au set 1**, puis alignement), pré-rempli avec l'alignement
   du set précédent et modifiable, persisté avant que le set suivant ne
   commence. Pas de pause chronométrée (§4, `SetBreakSheet` non fait).
4. **Fin de match** : navigation vers `summary.tsx` (pas de PDF, pas
   d'historique — §5/§4).
5. **Reprise** : si le match n'est pas `created`/`finished`,
   `reconstructLiveState(matchId)` reconstruit tout l'état depuis la DB
   (score, sets, alignement, rotation, service, libéros, remplacements +
   quota, temps morts, côtés inversés, capitaine en jeu) sans historique
   mémoire — testé par un scénario d'intégration bout en bout
   (`__tests__/matchStateReconstruction.test.ts`).

### Point d'entrée
Bouton **"Arbitrage"** sur `app/(tabs)/index.tsx` — propose "Reprendre le
match en cours" ou "Nouveau match" (confirmation d'abandon) s'il existe déjà
un match ad-hoc non terminé. **Pas** de bouton "Arbitrer" sur les cartes de
match (`matches.tsx`) — retiré du plan original à la demande explicite.

### `summary.tsx`
Inchangé — pas de bouton PDF, pas de section historique (§4/§5, hors scope
de cette itération).

---

## 7. Tests (TDD)

Fichiers réellement présents (certains noms diffèrent du plan original,
couverture équivalente ou supérieure) :

- `rulesValidator.test.ts` — un test par règle, y compris
  `getExceptionalSubstitutionEligibility`.
- `substitutionRules.test.ts` — `canLiberoEnter`, réciprocité, etc.
- `sanctionRules.test.ts` — `getDelaySanctionOutcome`, `isPlayerExpelled/Disqualified`.
- `sanctionService.test.ts` — `addSanction` atomique (point + sanction liés),
  `getSanctionsForMatch`.
- `volleyball-rules.test.ts` — couvre `shouldChangeEndsIndoor` (remplace
  `arbitrage-rules.test.ts` du plan original).
- `lineupService.test.ts` — round-trip save/get.
- `courtRotation.test.ts` — rotation + sortie libéro (auto/manuelle), source
  unique partagée store/reconstruction.
- `determineInitialServing.test.ts` — service manuel (set 1, set 5) préféré
  à la parité auto-résolue.
- `matchStateReconstruction.test.ts` — intégration bout en bout : séquence
  d'actions réelle → reconstruction depuis une DB en mémoire → état identique.
- `database-migrations.test.ts` — migrations additives non destructives.
- `matchSheetService.test.ts` — **n'existe pas** (service PDF non fait, §5).

---

## 8. Cas limites

- Expulsion/disqualification d'un titulaire → pas de simulation "jouer à 5"
  (hors scope, inchangé).
- Match "loisir" → écran arbitrage utilisable sans blocage (inchangé).
- Pas de capitaine renseigné → pas de blocage (inchangé ; pas de feuille PDF
  à produire actuellement, donc pas de zone de signature concernée).
- Reprise d'un match interrompu en plein set → couvert, voir §6.5.
- Undo sur une pénalité → annule sanction + point associé en une seule
  action (fait, testé).
- Remplacement exceptionnel accordé par erreur → pas de garde-fou
  automatique (décision humaine), mais `isExceptional: true` reste tracé
  dans `substitution_pairs` pour relecture (pas encore de PDF/historique
  pour l'afficher — §4/§5).

---

## 9. Critères de succès — état réel

- [x] Choix manuel du service affiché avant le set 1 **et** le set 5
- [x] Alignement I-VI redemandé et persisté (table `lineups`) avant chaque set
- [x] Alerte changement de côté à exactement 8 pts au 5e set indoor
- [x] 2 libéros sélectionnables par équipe, un seul actif à la fois, échange direct bloqué
- [x] Toute action illégale (remplacement, libéro, temps mort, sanction) bloquée avec message exact
- [x] "Remplacement exceptionnel" proposé uniquement quand aucun remplacement légal n'est possible
- [x] Sanction "pénalité" ajoute un point + service adverse de façon atomique, reflété en live (score/rotation)
- [ ] Pause de 3 min entre sets, décompte + buzzer, "passer" possible — **non fait**
- [x] Annuler fonctionne sur tout type de dernier événement, y compris sanctions liées à un point
- [ ] Historique point par point consultable par set (live et dans summary.tsx) — **non fait**
- [ ] PDF généré et partagé en fin de match, avec zones de signature capitaines — **non fait**
- [x] Un match interrompu se reprend exactement dans le même état (ajouté hors plan original)
