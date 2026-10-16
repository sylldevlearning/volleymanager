# Plan Phase 6 — Section Arbitrage (FIVB indoor / FFVolley)

## Objectif
Nouvel écran d'arbitrage officiel FIVB indoor, distinct de `referee.tsx` (qui reste
l'outil de scorage/stats pour coach). Réutilise le store, les services et le schéma
event-sourcing existants. Aucune logique copiée d'une autre app. Toute action illégale
au regard des règles FIVB/FFVolley est **bloquée** avec un message court et explicite.

## Décisions validées
- Nouvel écran dédié `app/match/[id]/arbitrage.tsx` (pas de modification de `referee.tsx`/`coach.tsx`).
- Support complet de 2 libéros par équipe : un seul actif sur le terrain à la fois,
  pas d'échange direct L1 ↔ L2 (doit repasser par le joueur remplacé).
- Les règles sont centralisées dans un module pur et testable
  `src/utils/rulesValidator.ts` — un test par règle (voir §7).

---

## 1. Modèle de données

### `matches` (migration v9 — ALTER)
```sql
ALTER TABLE matches ADD COLUMN captain_home_id TEXT REFERENCES players(id);
ALTER TABLE matches ADD COLUMN captain_away_id TEXT REFERENCES players(id);
```
`Match` (`src/models/match.ts`) gagne `captainHomeId: string | null`, `captainAwayId: string | null`.
Nouvelle fonction `matchService.setMatchCaptains(matchId, homeCaptainId, awayCaptainId)`.

### `sets` (migration v9 — ALTER)
```sql
ALTER TABLE sets ADD COLUMN serving_team_id TEXT REFERENCES teams(id);
```
`MatchSet` gagne `servingTeamId: string | null`. `matchService.createSet` accepte un
3e paramètre optionnel `servingTeamId?: string`. Persiste le choix manuel (set 1 et 5)
ou la valeur auto-calculée (sets 2-4) — nécessaire pour que la reprise d'un match
interrompu redonne le même service sans recalcul ambigu.

### `substitution_pairs` (migration v9 — ALTER)
```sql
ALTER TABLE substitution_pairs ADD COLUMN is_exceptional INTEGER DEFAULT 0;
```
`SubstitutionPair` gagne `isExceptional: boolean` (remplacement exceptionnel blessure,
hors quota — voir §2.7). Nouveau **`substitutionService.getPairsForMatch(matchId, teamId)`**
— agrège les paires sur **tous les sets** du match (nécessaire car un joueur sorti via
un remplacement exceptionnel ne peut plus revenir pour le **reste du match**, pas
seulement le set en cours ; `getPairsForSet` existant reste utilisé pour les
vérifications normales, limitées au set).

### `lineups` (table déjà existante, actuellement jamais écrite)
Nouveau service **`src/services/lineupService.ts`** :
- `saveLineup(matchId, setId, teamId, entries: {playerId, position, isStarter, isLibero}[])`
  → delete-then-insert pour ce (match, set, team).
- `getLineupForSet(matchId, setId, teamId)`.

Permet de persister l'alignement I-VI **avant chaque set** (pas seulement le 1er),
et alimente la feuille de match PDF.

### Libéro — pas de nouvelle table
`position: 'libero'` sur `Player` supporte déjà plusieurs joueurs. Seul le code de
construction d'alignement doit passer de `.find()` à `.filter()` (0 à 2 résultats).

`scoringStore` :
- Ajout `liberosHome: Player[]`, `liberosAway: Player[]` (pool éligible, posé par `initLineup`).
- `liberoHome`/`liberoAway: LiberoState | null` inchangés — ils représentent *le libéro
  actuellement actif* (un seul possible à la fois, conforme FIVB).
- `SubstitutionSheet.tsx` : si 2 libéros éligibles et aucun actif, afficher un sélecteur
  (chips) pour choisir lequel entre.

### Sanctions — pas de nouvelle table (cohérent avec "event-sourcing = source de vérité")
Extension de `ManagementEventType` (`src/models/event.ts`) :
```ts
| 'sanction_home' | 'sanction_away'
```
`details: { sanctionType: 'warning'|'penalty'|'expulsion'|'disqualification'|'delay', playerId: string | null, awardsPoint: boolean }`

Nouveau **`src/utils/sanctionRules.ts`** :
- `getDelaySanctionOutcome(priorDelayCountForMatch: number): { awardsPoint: boolean }`
  — règle FIVB : le 1er retard de jeu de tout le match = avertissement (pas de point),
  tout retard suivant = pénalité (point + service adverse).
- Les autres types (`warning`, `expulsion`, `disqualification`) n'attribuent jamais de
  point directement ; `penalty` attribue toujours un point.
- `isPlayerExpelled(playerId, sanctionEventsForSet)` / `isPlayerDisqualified(playerId, sanctionEventsForMatch)`
  — utilisées par `rulesValidator.ts` (§2.5).

Nouveau **`src/services/sanctionService.ts`** :
- `getSanctionsForMatch(matchId)` — filtre `getEventsForMatch` sur `sanction_home/away`.
- `addSanction(matchId, setId, team, { sanctionType, playerId })` — transaction unique :
  ajoute l'event `sanction_*`, et si `awardsPoint` est vrai, ajoute aussi l'event
  `point_*` opposé dans la **même** `withExclusiveTransactionAsync` (même pattern que
  `substitutionService.performSubstitution`).

`scoringStore` : nouvelle action `addSanctionEvent(team, sanctionEvent, pointEvent?)` —
pousse le(s) event(s), et si un point a été marqué, recalcule score/service/rotation
exactement comme `addPointEvent`.

### Undo d'une sanction avec point
`eventService.undoLastEvent` reste générique (annule le dernier event non-annulé). À
étendre : si l'event annulé est un `sanction_*` dont `details.awardsPoint === true`,
annuler **aussi** l'event `point_*` qui l'accompagnait (lié via `details.pointEventId`
ajouté à la sanction au moment de la création). Un seul tap "Annuler" défait les deux
événements liés.

---

## 2. Validation stricte des règles — `src/utils/rulesValidator.ts`

Module **pur** (aucune dépendance React/SQLite), façade stricte utilisée uniquement par
l'écran arbitrage. Il appelle les fonctions pures existantes (`substitutionRules.ts`,
`volleyball-rules.ts`, `sanctionRules.ts`) et centralise les vérifications + messages
FFVolley manquants. `referee.tsx`/`coach.tsx` continuent d'utiliser directement
`substitutionRules.ts` comme aujourd'hui (comportement inchangé, plus permissif).

```ts
export type RuleCode =
  | 'sub_quota_reached'
  | 'sub_starter_already_returned'
  | 'sub_wrong_return'
  | 'sub_reserve_already_used'
  | 'sub_player_on_court'
  | 'sub_player_expelled'
  | 'sub_player_disqualified'
  | 'sub_libero_not_allowed'
  | 'libero_front_row'
  | 'libero_rally_required'
  | 'timeout_quota_reached';

export interface RuleViolation {
  ok: false;
  code: RuleCode;
  message: string;                 // FR, prêt à afficher (voir tableau ci-dessous)
  params?: Record<string, string | number>; // pour une traduction i18n (t(code, params)) si besoin
  allowExceptional?: boolean;      // true quand "Remplacement exceptionnel" doit être proposé
}
export interface RuleOk { ok: true }
export type RuleResult = RuleOk | RuleViolation;

export interface RuleWarning {      // alerte non bloquante
  code: 'libero_cannot_serve';
  message: string;
}
```

Le module reste pur et retourne directement le texte français (testable tel quel en
Jest sans setup i18n) ; la couche UI (`arbitrage.tsx`) enregistrera en parallèle les
mêmes libellés sous des clés `arbitrage.errors.*` dans `fr.json`/`en.json`, conformément
à la convention i18n du projet, en passant par `params` pour l'interpolation.

### 2.1 Remplacements réguliers — `validateRegularSubstitution(ctx)`
| Code | Message exact |
|---|---|
| `sub_quota_reached` | `"{{max}} remplacements déjà effectués dans ce set."` |
| `sub_starter_already_returned` | `"Le n°{{number}} est déjà sorti et revenu dans ce set."` |
| `sub_wrong_return` | `"Le n°{{outNumber}} ne peut revenir qu'à la place du n°{{expectedNumber}}."` |
| `sub_reserve_already_used` | `"Le n°{{reserveNumber}} est déjà entré dans ce set, il ne peut être remplacé que par le n°{{starterNumber}}."` |
| `sub_player_on_court` | `"Le n°{{number}} est déjà sur le terrain."` |
| `sub_player_expelled` | `"Le n°{{number}} est expulsé pour ce set."` |
| `sub_player_disqualified` | `"Le n°{{number}} est disqualifié pour le match."` |
| `sub_libero_not_allowed` | `"Le libéro ne peut pas participer à un remplacement régulier."` |

Réutilise `countNormalSubs`, la logique de réciprocité de `validateSubstitution`
(`substitutionRules.ts`) et `sanctionRules.isPlayerExpelled/isPlayerDisqualified` —
mais remplace les codes muets existants (`max_reached`, `reciprocity_violation`,
`not_eligible`) par des messages numérotés (n° de maillot via `Player.number`).

### 2.2 Libéro — entrée (zone arrière uniquement, hors quota, 1 point joué entre deux remplacements)
`validateLiberoSubstitution(ctx)`
| Code | Message |
|---|---|
| `libero_front_row` | `"Le libéro ne peut pas entrer en zone avant."` |
| `libero_rally_required` | `"Il doit y avoir au moins un échange de jeu entre deux remplacements de libéro."` |

Réutilise `isBackRow` (`substitutionRules.ts`). L'entrée ne consomme jamais le quota de
remplacements (`substitutionsHome`/`substitutionsAway` inchangés, comme aujourd'hui).

`checkLiberoRallySinceLastReplacement(events, teamId)` : scanne les events du set,
trouve le dernier `substitution_*` avec `details.isLibero === true` pour l'équipe,
vérifie qu'au moins un `point_home`/`point_away` a eu lieu après. Couvre aussi bien
une ré-entrée après sortie manuelle que l'entrée initiale du set.

### 2.3 Libéro — sortie automatique (rotation vers l'avant)
Quand la rotation amène le libéro actif de la zone arrière vers la zone avant
(ex. V → IV), le joueur qu'il remplaçait reprend **automatiquement** sa place, sans
action de l'arbitre. Logique de prédiction centralisée dans **une seule fonction pure**
réutilisée par le store ET par l'écran (pour qu'elle soit enregistrée comme événement) :

```ts
// substitutionRules.ts
export function predictLiberoAutoExit(
  libero: LiberoState, rotatingForward: boolean
): { mustExit: boolean; newPosition: number } { ... }
```

`scoringStore.addPointEvent` (logique déjà existante pour la rotation libéro) est
refactorisée pour appeler cette fonction au lieu de dupliquer le calcul inline.
L'écran `arbitrage.tsx` appelle la **même** fonction juste avant de persister le point,
et si `mustExit === true`, enregistre un event `substitution_home/away` avec
`details.isLibero: true, details.isAutomatic: true` (même transaction que le point) —
visible dans l'historique, annulable via `undoLastEvent` (qui annule alors point + sortie
libéro ensemble, comme pour les sanctions §1), et listé dans la feuille de match PDF.

### 2.4 Libéro — sortie manuelle
Tap sur le libéro en jeu (sur le terrain, dans `arbitrage.tsx`) → menu contextuel avec
une option **"Sortir le libéro"**. Confirme → le joueur remplacé revient à sa place.
Enregistré comme un event `substitution_home/away`, `details.isLibero: true,
details.isAutomatic: false` — même écriture que `performSubstitution` existant
(`isLibero: true`), pas de nouvelle fonction de service nécessaire.

Pas d'alerte "le libéro ne peut pas servir" (retiré du plan).

### 2.5 Joueur indisponible
Couvert par `sub_player_on_court` / `sub_player_expelled` / `sub_player_disqualified`
ci-dessus (§2.1) — dérivé des events `sanction_home/away` (`expulsion` → indisponible
pour le reste du **set** ; `disqualification` → indisponible pour le reste du **match**,
vérifié via `getPairsForMatch` + `getSanctionsForMatch`).

### 2.6 Temps morts — `validateTimeoutRequest(used, max, teamName)`
| Code | Message |
|---|---|
| `timeout_quota_reached` | `"Plus de temps mort disponible pour {{teamName}} dans ce set."` |

### 2.7 Remplacement exceptionnel (blessure)
`getExceptionalSubstitutionEligibility(ctx): { eligible: boolean }` — quand
`validateRegularSubstitution` échoue avec `sub_quota_reached`, `sub_wrong_return` ou
`sub_reserve_already_used` **et** qu'aucune autre combinaison légale n'existe pour
sortir le joueur blessé, l'UI affiche un bouton **"Remplacement exceptionnel"**. Celui-ci :
- bypass le quota (`isExceptional: true` sur la paire + l'event `substitution_*`),
- marque le joueur sorti **définitivement indisponible pour le reste du match**
  (vérifié ensuite via `getPairsForMatch` dans toutes les vérifications futures),
- apparaît distinctement dans l'historique et la feuille de match PDF.

---

## 3. Règles FIVB nouvelles (`src/utils/volleyball-rules.ts`)

```ts
export function shouldChangeEndsIndoor(
  scoreHome: number, scoreAway: number, setNumber: number, config: MatchConfig
): boolean {
  return isLastSet(setNumber, config) && (scoreHome === 8 || scoreAway === 8);
}
```
Déclenché une seule fois (comme `shouldChangeEndsBeach`), branché dans
`scoringStore.addPointEvent` pour `match.format === 'indoor_6v6'` (actuellement seule
la branche beach existe). Réutilise la modale `showChangeEnds`/`dismissChangeEnds`
déjà présente dans le store — extraction d'un composant partagé
`src/components/scoring/ChangeEndsModal.tsx` pour éviter la duplication entre
`referee.tsx` et `arbitrage.tsx`.

---

## 4. Nouveaux composants (`src/components/arbitrage/`)

| Composant | Rôle |
|---|---|
| `ServeChoiceModal.tsx` | Choix manuel de l'équipe au service — affiché uniquement avant la création du set 1 et du set 5. |
| `PreSetLineupSheet.tsx` | Alignement I-VI + libéro(s), affiché avant **chaque** set. Réutilise la logique extraite de `lineup.tsx` (voir ci-dessous). |
| `SanctionSheet.tsx` | Équipe → joueur (ou vide = staff) → type de sanction → confirmation. Codes couleur FIVB (🟨 avertissement, 🟥 pénalité, 🟨🟥 expulsion/disqualification, ⏱️ retard de jeu). |
| `SetBreakSheet.tsx` | Pause 3 min (180s) entre sets — même pattern que `TimeoutTimerSheet.tsx` (buzzer, bouton "passer" pour l'arbitre). |
| `CaptainPicker.tsx` | Sélection du capitaine par équipe, affiché une fois avant le set 1. |
| `EventHistoryList.tsx` | Historique chronologique point par point d'un set (points, temps morts, remplacements, sanctions) — icône + équipe/joueur + horodatage. |
| `RuleViolationToast.tsx` | Affiche `RuleViolation.message` (toast/bannière courte) et, si `allowExceptional`, le bouton "Remplacement exceptionnel". |

### Extraction partagée
`src/features/lineup/lineupBuilder.ts` — déplace les fonctions pures de `lineup.tsx`
(`buildInitialSlots`, `buildSideLineup`, logique `toggleStarter`/`togglePresent`) pour
qu'elles soient réutilisées à la fois par l'écran `lineup.tsx` existant (1er alignement,
avant set 1) et `PreSetLineupSheet.tsx` (tous les sets suivants).

---

## 5. Nouveau service PDF

**`src/services/matchSheetService.ts`**
- `generateMatchSheetHtml(data): string` — fonction pure, facilement testable sans
  mocker `expo-print`. Sections : équipes, alignements par set (via `lineupService`),
  scores par set, remplacements (y compris exceptionnels), temps morts, sanctions,
  résultat final, 2 zones de signature (capitaine domicile / capitaine extérieur).
- `exportMatchSheetPdf(matchId): Promise<void>` — rassemble les données via les
  services existants + nouveaux (`matchService`, `lineupService`, `sanctionService`,
  `eventService`), appelle `Print.printToFileAsync({ html })` puis `Sharing.shareAsync(uri)`.

Dépendances à ajouter : `npx expo install expo-print expo-sharing` (versions alignées
SDK 57), vérifiées ensuite par `npx expo-doctor`.

Déclenché par un nouveau bouton **"Exporter la feuille de match (PDF)"** sur
`app/match/[id]/summary.tsx` (écran existant, pas de nouvelle route).

---

## 6. Écrans

```
app/match/[id]/
  arbitrage.tsx          NOUVEAU — écran principal d'arbitrage FIVB
  lineup.tsx             existant, inchangé (1er alignement, avant set 1)
  referee.tsx            existant, inchangé (scorage/stats coach)
  coach.tsx               existant, inchangé
  summary.tsx             existant + bouton PDF + section historique point par point
```

### `arbitrage.tsx` — flux
1. **Avant le match** (`match.status === 'created'`) — séquence de modales, dans l'ordre :
   `CaptainPicker` (une fois) → `ServeChoiceModal` (set 1) → `PreSetLineupSheet` (home puis away) → écran de score.
2. **Pendant le set** : score (réutilise `ScoreButton`/`SetTracker` de `src/components/scoring/`),
   indicateur de service, temps morts (réutilise `TimeoutTimerSheet` existant, 30s —
   bloqué via `validateTimeoutRequest`), remplacements (réutilise `SubstitutionSheet`
   existant, étendu 2-libéros — bloqués via `rulesValidator`, avec option "Remplacement
   exceptionnel"), bouton **Sanctions** → `SanctionSheet`, bouton **Historique** →
   `EventHistoryList` (drawer, set en cours), bouton **Annuler** (réutilise
   `UndoButton`/`undoLastEvent` tel quel — déjà générique à tout type d'event).
   Alerte changement de côté à 8 pts au 5e set (indoor) via `ChangeEndsModal` partagé.
   Tap sur le libéro en jeu → "Sortir le libéro" (sortie manuelle, §2.4) ; sortie
   automatique gérée en silence par `predictLiberoAutoExit` + enregistrement d'event (§2.3).
3. **Fin de set** : `SetBreakSheet` (3 min, skippable) → si prochain set = 5,
   `ServeChoiceModal` à nouveau ; sinon service auto-résolu → `PreSetLineupSheet`
   (home puis away) pour le set suivant → retour à l'écran de score.
4. **Fin de match** : navigation vers `summary.tsx` (bouton PDF + historique complet
   disponibles).

### Point d'entrée
Bouton **"Arbitrer"** ajouté sur la carte de match dans `app/(tabs)/matches.tsx`
(aux côtés des boutons Coach/Stats existants), visible pour les matchs `created`/`live`.

### `summary.tsx` — ajouts
- Bouton "Exporter la feuille de match (PDF)" → `exportMatchSheetPdf(match.id)`.
- Section "Historique" (par set) → réutilise `EventHistoryList` en lecture seule,
  pour tous les sets du match.

---

## 7. Tests (TDD — écrits avant le code, `__tests__/`)

- **`rulesValidator.test.ts`** — un test par règle :
  - `sub_quota_reached` (6 subs atteints → bloqué, message exact)
  - `sub_starter_already_returned`
  - `sub_wrong_return`
  - `sub_reserve_already_used`
  - `sub_player_on_court`
  - `sub_player_expelled`
  - `sub_player_disqualified`
  - `sub_libero_not_allowed`
  - `libero_front_row`
  - `libero_rally_required` (bloqué sans point joué depuis le dernier remplacement libéro, autorisé après)
  - `timeout_quota_reached`
  - `predictLiberoAutoExit` (sortie auto déclenchée en zone avant, pas déclenchée si encore en zone arrière)
  - `getExceptionalSubstitutionEligibility` : eligible après quota atteint sans alternative légale, non eligible si une substitution légale existe encore
- `arbitrage-rules.test.ts` — `shouldChangeEndsIndoor` (déclenchement exact à 8 pts,
  5e set uniquement, une seule fois), `getDelaySanctionOutcome` (1er retard = pas de
  point, 2e+ = point).
- `substitutionRules.test.ts` (extension) — `canLiberoEnter` : bloque L2 si L1 actif,
  autorise après sortie de L1, réciprocité par libéro individuel.
- `lineupService.test.ts` — round-trip save/get sur la table `lineups`.
- `sanctionService.test.ts` — `addSanction` atomique (event sanction + event point
  liés), annulation en cascade via `undoLastEvent` étendu.
- `matchSheetService.test.ts` — `generateMatchSheetHtml` sur données fixtures
  (fonction pure, pas de mock `expo-print` nécessaire).

---

## 8. Cas limites

- Expulsion/disqualification d'un titulaire → le plan **ne simule pas** "jouer à 5"
  (hors scope v1, à traiter dans une itération future si besoin).
- Match "loisir" → l'écran arbitrage reste utilisable (capitaine/sanctions/pause 3min
  optionnels, pas de blocage), cohérent avec `DEFAULT_LEISURE_CONFIG` existant.
- Pas de capitaine renseigné → la feuille PDF affiche "—" dans la zone de signature,
  aucun blocage de l'export.
- Reprise d'un match interrompu en plein set → `serving_team_id` déjà persisté en base
  évite tout recalcul ambigu du service initial.
- Undo sur une pénalité → annule sanction + point associé en une seule action.
- Remplacement exceptionnel accordé par erreur alors qu'une solution légale existait →
  pas de garde-fou automatique (décision humaine de l'arbitre), mais tracé distinctement
  dans l'historique/PDF pour relecture.

---

## 9. Critères de succès

- [ ] Choix manuel du service affiché uniquement avant le set 1 et le set 5
- [ ] Alignement I-VI redemandé et persisté (table `lineups`) avant chaque set
- [ ] Alerte changement de côté à exactement 8 pts au 5e set indoor
- [ ] 2 libéros sélectionnables par équipe, un seul actif à la fois, échange direct bloqué
- [ ] Toute action illégale (remplacement, libéro, temps mort) bloquée avec message exact
- [ ] "Remplacement exceptionnel" proposé uniquement quand aucun remplacement légal n'est possible
- [ ] Sanction "pénalité" ajoute un point + service adverse de façon atomique
- [ ] Pause de 3 min entre sets, décompte + buzzer, "passer" possible
- [ ] Annuler fonctionne sur tout type de dernier événement, y compris sanctions liées à un point
- [ ] Historique point par point consultable par set (live et dans summary.tsx)
- [ ] PDF généré et partagé en fin de match, avec zones de signature capitaines
