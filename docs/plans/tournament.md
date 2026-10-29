# Plan — Mode Tournoi (v1.1.0, branche `feat/tournoi`)

Statut : **validé**. Phases 1 et 2 faites.

Décisions : 4×4 et 3×3 en saisie manuelle seulement (pas de QR ni d'arbitrage) ;
équipes saisies par leur nom gardées dans le tournoi ; « Arbitrer ici » en
phase 4 ; commit + push de `feat/tournoi` à chaque phase, sans PR ni build.

## Principes
- 100 % local : un appareil organisateur, pas de compte ni de serveur, SQLite.
- Réutilise : thème sombre, composants UI, « Mes équipes », mode arbitrage
  (`arbitrage/new` + `match/[id]/arbitrage`), `rulesValidator`, `MatchConfig`.
- Toutes les règles sont des données (`TournamentRules`), avec des valeurs par
  défaut ; rien n'est codé en dur dans le moteur.
- Moteur en TypeScript pur (`src/features/tournament/engine/`), sans React ni
  SQLite, déterministe pour une graine donnée, développé en TDD.

## Schéma de données (migration v14)

```sql
CREATE TABLE tournaments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  date TEXT NOT NULL,              -- 'YYYY-MM-DD'
  location TEXT,
  game_type TEXT NOT NULL,         -- 'indoor_6v6' | 'indoor_4v4' | 'indoor_3v3' | 'beach_2v2'
  format TEXT NOT NULL,            -- 'round_robin' | 'pools_knockout' | 'knockout'
  rules_json TEXT NOT NULL,        -- TournamentRules (voir plus bas)
  schedule_json TEXT NOT NULL,     -- { courts, startTime 'HH:MM', matchMinutes, restMinutes }
  seed INTEGER NOT NULL,           -- graine du tirage (déterminisme)
  seeding TEXT NOT NULL,           -- 'random' | 'seeded' (têtes de série)
  secret TEXT NOT NULL,            -- clé de vérification des QR codes
  status TEXT NOT NULL DEFAULT 'live', -- 'live' | 'finished'
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE tournament_teams (
  id TEXT PRIMARY KEY,
  tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  team_id TEXT REFERENCES teams(id) ON DELETE SET NULL, -- NULL = saisie rapide
  name TEXT NOT NULL,              -- copie : le tournoi survit à la suppression de l'équipe
  color TEXT NOT NULL,
  seed_rank INTEGER,               -- tête de série (1 = meilleure), NULL sinon
  pool_id TEXT REFERENCES tournament_pools(id) ON DELETE SET NULL,
  position INTEGER NOT NULL        -- ordre d'inscription (dernier critère d'égalité)
);

CREATE TABLE tournament_pools (
  id TEXT PRIMARY KEY,
  tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,              -- 'A', 'B'…
  position INTEGER NOT NULL
);

CREATE TABLE tournament_matches (
  id TEXT PRIMARY KEY,
  tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  stage TEXT NOT NULL,             -- 'league' | 'pool' | 'knockout' | 'placement'
  pool_id TEXT REFERENCES tournament_pools(id) ON DELETE CASCADE,
  round INTEGER NOT NULL,          -- journée de poule, ou tour de tableau (1 = 1er tour)
  bracket_slot INTEGER,            -- position dans le tableau (phase finale)
  label TEXT,                      -- 'Quart 1', 'Finale', 'Match pour la 3e place'
  home_id TEXT REFERENCES tournament_teams(id),  -- NULL tant que non qualifié
  away_id TEXT REFERENCES tournament_teams(id),
  home_source TEXT,                -- JSON : {"pool":"A","rank":1} | {"winnerOf":"<id>"} | {"loserOf":"<id>"} | {"bestOf":3,"index":1}
  away_source TEXT,
  slot INTEGER,                    -- créneau du planning (0 = heure de début)
  court INTEGER,                   -- 1..courts
  scheduled_at TEXT,               -- 'YYYY-MM-DDTHH:MM', figé quand le match est placé
  status TEXT NOT NULL DEFAULT 'scheduled', -- 'scheduled' | 'live' | 'validated'
  sets_json TEXT,                  -- [[25,18],[23,25],[15,12]]
  forfeit_id TEXT REFERENCES tournament_teams(id), -- équipe forfait
  winner_id TEXT REFERENCES tournament_teams(id),
  result_source TEXT,              -- 'manual' | 'qr' | 'arbitrage'
  arbitrage_match_id TEXT REFERENCES matches(id) ON DELETE SET NULL,
  validated_at TEXT,
  position INTEGER NOT NULL,       -- ordre de génération
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_tmatches_tournament ON tournament_matches(tournament_id);

CREATE TABLE tournament_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  payload_json TEXT NOT NULL,      -- game_type, format, rules, schedule (sans équipes)
  created_at TEXT NOT NULL
);
```

Les matchs arbitrés gardent leur place dans `matches` / `match_events` : le
tournoi ne garde qu'un lien (`arbitrage_match_id`) et le résultat validé.

### `TournamentRules` (JSON, valeurs par défaut selon le type)
```ts
interface TournamentRules {
  match: { setsToWin: number; pointsPerSet: number; tieBreak: boolean;
           tieBreakPoints: number; winMargin: number };   // mêmes noms que MatchConfig
  finalsMatch?: TournamentRules['match'];                  // règles différentes en phase finale (option)
  points: { winClear: 1; winTight: 1; lossTight: 0; lossClear: 0; forfeitLoss: 0 }; // 3/2/1/0 en préréglage
  tiebreakers: ('headToHead' | 'setDifference' | 'pointDifference' | 'pointsScored')[]; // ordre modifiable
  forfeitScore: { sets: 'max'; pointsPerSet: number };    // forfait = 3-0 (25-0) par défaut
  pools?: { count: number; qualifiersPerPool: number; bestOthers: number };
  knockout?: { thirdPlace: boolean };
  roundRobinLegs: 1 | 2;                                    // aller simple / aller-retour
}
```
« Serré » = gagné ou perdu au set décisif (3-2 / 2-1). Les égalités restantes
après les critères se départagent par tête de série puis par l'ordre d'inscription.

## Moteur (`src/features/tournament/engine/`)
| Module | Rôle |
|---|---|
| `rng.ts` | PRNG à graine (mulberry32), mélange déterministe. |
| `defaults.ts` | Valeurs par défaut selon type et nombre d'équipes (poules, qualifiés, durées). |
| `pools.ts` | Répartition aléatoire à graine, ou en serpentin par têtes de série. |
| `roundRobin.ts` | Rencontres de poule par journées (méthode de Berger, exempt si impair). |
| `bracket.ts` | Tableau à élimination directe : taille puissance de 2, exempts aux meilleurs, placement standard (1-16, 8-9…), croisement des poules (1er A contre 2e B, jamais deux équipes de la même poule au 1er tour si évitable), petite finale. |
| `results.ts` | Validation d'un score avec les règles (sets, tie-break, écart), vainqueur calculé, forfait. |
| `standings.ts` | Classement : points du barème, puis critères dans l'ordre configuré ; confrontation directe = mini-classement entre les équipes à égalité. |
| `qualification.ts` | Qualifiés par poule + meilleurs Nᵉ ; remplit les `source` du tableau ; vainqueurs et perdants avancent. |
| `scheduler.ts` | Planning par créneaux et terrains : jamais deux matchs simultanés pour une équipe, repos respecté si possible (2ᵉ passe sans repos sinon), un match de tableau jamais avant la fin des matchs qui le nourrissent. |
| `regenerate.ts` | Régénération qui garde intacts les matchs `validated` (et `live`) : équipes, terrain, horaire, score. Refuse (`locked`) si un résultat validé devrait changer. |
| `finalRanking.ts` | Classement final (championnat : tableau ; phases finales : tour atteint puis stats de poule). |

Corrections : corriger un résultat de poule recalcule les qualifiés ; les matchs
de tableau **non validés** se mettent à jour. Si un match de tableau dépendant
est déjà validé, la correction est bloquée avec la liste des matchs concernés.

### Tests du moteur
- 4, 8, 12, 16, 24, 32, 64 équipes × 3 formats : chaque paire d'une poule se
  rencontre exactement une fois, aucune équipe deux fois sur un créneau, terrains
  dans `1..courts`, repos respecté quand c'est possible, tableau de bonne taille
  avec les bons exempts, phases finales après les poules.
- Même graine → même tirage et même planning ; autre graine → autre tirage.
- Classement : barème par défaut, barème modifié, chaque critère d'égalité,
  égalité à trois, quotient avec 0 set perdu.
- Régénération : aucun match validé modifié.

### Écarts par rapport à la proposition (phase 1)
- `withdrawn` retiré (forfait général non demandé) ; `position` ajoutée aux
  équipes (dernier critère d'égalité) et aux matchs (ordre stable).
- `slot` ajouté aux matchs : le moteur raisonne en créneaux ; `scheduled_at`
  garde l'heure affichée.
- `forfeitScore` retiré des règles : un forfait donne tous les sets à l'autre
  équipe, à la cible du set (25-0) ; seul `points.forfeitLoss` est réglable.
- Repos : en créneaux (`ceil(repos / durée)`) — 10 min de repos = au moins un
  créneau sans jouer. Il est relâché seulement si sinon le créneau resterait
  vide ; un terrain peut donc rester libre pour respecter le repos.
- Comparaison entre poules (meilleurs Nᵉ, non-qualifiés) : points par match
  (poules de tailles différentes), quotient sets, quotient points.

### Retours après test (assistant v2)
- Barème par défaut : victoire 1 point, défaite 0 ; 3-2-1-0 en préréglage.
- Égalités par défaut : confrontation directe, différence de sets, différence
  de points, plus de points marqués (plus de quotients). Entre poules : les
  mêmes valeurs ramenées au nombre de matchs joués.
- Poules automatiques : de 4 en priorité, complétées par des poules de 3
  (`ceil(n / 4)` poules), jamais de 5.
- Étape 3 : nombre d'équipes (8 par défaut) et de terrains d'abord, estimation
  immédiate (poules, matchs, fin, durée) ; « Équipe N » par défaut, noms
  modifiables dans la liste ; « Mes équipes » remplit les équipes pas encore
  renommées ; noms en double surlignés. Renommage après création :
  `renameTournamentTeam` (écran en phase 3).

## Phases
### Phase 1 — Modèle + moteur
`src/models/tournament.ts`, migration v14, `tournamentService.ts` (CRUD,
transaction de création), moteur complet et ses tests. Pas d'écran.

### Phase 2 — Assistant de création (fait)
- Accueil : bouton « Tournoi » → `app/tournament/index.tsx` (liste, du plus
  récent au plus ancien, statut En cours / Terminé, « Nouveau tournoi »).
  Les cartes s'ouvriront en phase 3.
- `app/tournament/new.tsx` : barre de progression, « Retour » / « Suivant »,
  erreurs de l'étape au-dessus des boutons, confirmation avant d'abandonner.
  1. Nom, date (aujourd'hui, JJ/MM/AAAA), lieu, type ; « Partir d'un
     modèle » (appui long = supprimer). 4×4 / 3×3 : mention « saisie à la main ».
  2. Format (3 cartes), sets gagnants, points, tie-break, écart. « Réglages
     avancés » : 3e place, règles de phase finale, aller-retour, barème,
     ordre des critères d'égalité.
  3. Équipes (« Mes équipes » en liste à cocher, ou nom seul), têtes de série
     (ordre de la liste, flèches), conseil de format selon le nombre d'équipes,
     poules (automatique tant qu'on n'y touche pas), terrains, heure, durée, repos.
  4. Récapitulatif : règles, nb de matchs, fin estimée, poules tirées,
     « Retirer au sort » (nouvelle graine), « Enregistrer comme modèle », « Créer ».
- Logique pure dans `src/features/tournament/wizard.ts` (testée) ; les lignes
  de formulaire (`Stepper`, `ToggleRow`, `FormField`) sont partagées avec la
  configuration d'arbitrage (`src/components/ui/FormControls.tsx`).
- Modèle : règles + planning sans les équipes ; des poules automatiques restent
  automatiques (`rules.pools = null`) pour s'adapter au nombre d'équipes.

### Phase 3 — Planning, Matchs, Classement
- `app/tournament/[id]/index.tsx` : onglets Planning (par heure × terrain),
  Matchs (filtres phase / poule / équipe / statut), Classement (poules + tableau
  + classement final).
- `app/tournament/[id]/match/[matchId].tsx` : saisie set par set, vainqueur
  calculé, erreurs du moteur (« Le set 2 doit avoir 2 points d'écart »),
  « Forfait de… », correction d'un résultat validé (avec confirmation).
- Régénérer le planning (terrain indisponible, retard) sans toucher aux résultats.

### Phase 4 — QR codes
- Format : `VMT1:` + JSON en base64url, avec `v`, `kind` (`match` | `result`),
  `t` (tournoi), `m` (match), équipes, règles du match, et `sig`
  (SHA-256 tronqué de la charge + `secret` du tournoi).
- Organisateur : bouton « QR de ce match » sur la fiche du match.
- Arbitre : « Scanner un QR » (accueil Tournoi) → ouvre la configuration
  d'arbitrage déjà remplie (équipes, couleurs, règles, joueurs si connus) ; le
  match arbitré garde la référence tournoi/match.
- En fin de match arbitré : « QR du résultat » ; l'organisateur le scanne → récap
  → « Enregistrer » ; refus clair si mauvais tournoi, mauvais match, QR modifié
  ou version inconnue.
- « Arbitrer ici » : arbitrer sur l'appareil organisateur, résultat repris
  automatiquement.
- La vérification protège contre les erreurs (mauvais QR, autre tournoi, QR
  abîmé ou modifié à la main), pas contre une triche délibérée : la clé voyage
  dans le QR du match.

### Phase 5 — Export
- Planning et classement en image (rendu dédié, lisible sur un téléphone) ou
  PDF (HTML généré par une fonction pure, testée), partagés par la feuille de
  partage du système (WhatsApp, etc.).

Chaque phase : `tsc`, tests, commit sur `feat/tournoi`. Version 1.1.0 à la fin.

## Nouvelles dépendances (versions Expo SDK 57 via `npx expo install`)
- `react-native-qrcode-svg` (affichage QR, s'appuie sur react-native-svg) — phase 4.
- `expo-camera` (lecture QR) — phase 4 : nouvelle permission caméra.
- `react-native-view-shot`, `expo-print`, `expo-sharing` — phase 5.
- `expo-crypto` (SHA-256) — phase 4.
Les phases 4 et 5 demandent un nouveau build natif pour être testées hors Expo Go.

## Hors périmètre
Comptes, serveur, temps réel, notifications, double élimination,
montante-descendante.
