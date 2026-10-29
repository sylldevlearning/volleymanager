# Plan — Arbitrage 4×4, 3×3 et 2×2 (avant la phase 4 du tournoi)

Statut : **validé**. Branche `feat/tournoi`.

Décisions : 2×2 loisir avec remplacements libres ; 3×3 loisir avec changement
de côté entre les sets seulement ; temps mort technique du beach en option,
activé seulement dans le préréglage officiel ; 4×4 officiel sans libéro, et ce
préréglage s'appelle « Officiel M13 (FFVolley) » (le texte vise les moins de 13 ans).

## Sources vérifiées
- **4×4 — FFVolley, réglementation particulière M13** (ffvb.org) : « par
  principe, les règles du 6×6 s'appliquent au 4×4 », avec ces précisions :
  4 joueurs + 4 remplaçants au plus ; position 1 = arrière, 2 = avant droit,
  3 = avant centre, 4 = avant gauche ; en réception, avants dans l'ordre 2-3-4
  et arrière derrière eux ; au service, placement libre ; rotation 1 → 2 → 3 →
  4 ; l'arrière ne contre pas et n'attaque pas au-dessus du filet en zone
  avant ; 4 remplacements, libres sauf : le joueur en position 1 ne remplace
  pas celui en position 2, un joueur sorti ne revient qu'après au moins un
  échange ; 2 temps morts de 30 s par set. Libéro, points par set et
  changement de côté : non précisés (donc règles du 6×6 « par principe »).
- **2×2 — FIVB beach (page « basic rules », fivb.com)** : 2 joueurs, aucun
  remplacement ; le joueur qui n'a pas servi la dernière fois sert quand
  l'équipe reprend le service ; 1 temps mort de 30 s par set ; temps mort
  technique de 30 s à 21 points cumulés aux sets 1 et 2 ; changement de côté
  tous les 7 points (5 au 3e set) ; sets de 21, 3e set à 15, 2 points
  d'écart ; pas de libéro. (Résumé officiel ; le PDF 2025-2028 complet n'a pas
  été relu.)
- **3×3 — aucun règlement FFVolley trouvé.** Référence la plus proche : FIVB
  snow-volley 2021-2024 (cev.eu) : 3 joueurs + 1 remplaçant, 2 remplacements
  par set (un titulaire ne sort qu'une fois et revient à sa place) ; aucune
  position imposée, seul l'ordre de service compte et tourne à chaque reprise
  du service ; 1 temps mort de 30 s par set ; changement de côté tous les
  5 points ; sets de 15, 2 sets gagnants.

## Écarts avec mon tableau de départ
| Point | Mon tableau | Texte officiel |
|---|---|---|
| 4×4 positions | 4 positions, 2 avant / 2 arrière (implicite) | 1 arrière + 3 avants (2-3-4) |
| 4×4 fautes de position | réglable, désactivé | existent pour l'équipe en réception ; placement libre au service ; restrictions de l'arrière |
| 4×4 remplacements | libres, illimités | 4 par set, sauf 1 → 2 interdit, retour après au moins un échange |
| 4×4 temps morts | 1 × 30 s | 2 × 30 s |
| 4×4 libéro | aucun | non précisé (6×6 « par principe ») |
| 3×3 | positions 1-3, remplacements libres, changement entre les sets | (snow) positions libres + ordre de service, 2 remplacements, côté tous les 5 points, sets de 15 |
| 2×2 temps mort technique | à vérifier | confirmé : à 21 points cumulés, sets 1 et 2 |

Les valeurs « loisir » demandées restent les défauts ; chaque format a un
préréglage **« Officiel »** (FFVolley 4×4 M13, FIVB snow pour le 3×3, FIVB beach
pour le 2×2) qui remplit les règles ci-dessus.

## Conception
### 1. Un profil par format (source unique) — `src/features/match/formatProfile.ts`
| | 6×6 | 4×4 | 3×3 | 2×2 |
|---|---|---|---|---|
| Joueurs sur le terrain | 6 | 4 | 3 | 2 |
| Places | I-VI (inchangé) | 1 arrière, 2-3-4 avants | 1-2-3 (ordre de service) | 1-2 (ordre de service) |
| Libéro possible | oui | non | non | non |
| Effectif max | 14 | 8 | 6 | 4 |

`MatchFormat` += `'indoor_4v4' | 'indoor_3v3'` (le 2×2 reste `beach_2v2`).

### 2. Règles réglables (`MatchConfig`, dans `config_json` : pas de colonne)
- `positionalFaults` (4×4 / 3×3, défaut non). **L'app ne détecte pas les
  fautes de position, déjà le cas en 6×6** : le réglage change l'affichage
  (zones fixes 2-3-4 / 1 et rappel « réception : 2-3-4 de droite à gauche » ou
  seulement l'ordre de service).
- `substitutionMode` : `'free'` (n'importe quel remplaçant pour n'importe quel
  joueur, sans couple ni retour à la même place) ou `'fivb'` (6×6, inchangé) ;
  + les quotas existants (`substitutionsPerSet`, `unlimitedSubstitutions`).
  Option 4×4 officielle : « 1 ne remplace pas 2 » et « retour après un échange ».
- Temps morts : champs existants (`timeoutsPerSet`, `timeoutDurationSec`) —
  défaut 1 × 30 s.
- `courtSwitch` : `{ every, everyDecidingSet } | null` — 2×2 : 7 / 5 ; null =
  aux changements de set seulement. 6×6 : règle actuelle (8 points au set
  décisif), inchangée.
- Libéro : sélection masquée si le format n'en a pas.
- Sets par défaut alignés sur le tournoi : 4×4 2 sets de 21 + tie-break 15 ;
  3×3 1 set de 21 ; 2×2 2 sets de 21 + tie-break 15.

### 3. Rotation, service, reprise, annuler
- `rotateCourt(court, size)` : p → p − 1, 1 → size (6×6 : identique
  à aujourd'hui). Tableau de rotation de longueur `size`. En 2×2, la rotation
  à 2 places = service alterné entre les deux joueurs.
- Même fonction dans le store en direct et dans le rejeu (`replayCourtState`,
  `reconstructLiveState`) : reprise et « Annuler » restent cohérents.

### 4. Écrans du mode arbitrage
- `arbitrage/new.tsx` : choix du format en haut (6×6 / 4×4 / 3×3 / 2×2),
  minimum de joueurs = taille du terrain, libéro masqué, onglet Règles avec
  les réglages du format et les boutons « Loisir » / « Officiel ».
- `FullCourt` : disposition par format (6×6 strictement inchangée) ; 4×4 :
  3 avants le long du filet + 1 arrière ; 3×3 : triangle ; 2×2 : deux places.
- Composition de départ (mode « lineup » de l'écran d'arbitrage) : N places.
- Fiche de remplacement : mode libre ; message actuel « pas de remplacement »
  si le format ou le préréglage l'interdit.
- Changement de côté : alerte existante, déclenchée par `courtSwitch`.
- Historique : libellé du format (4 valeurs au lieu de 2).
- Hors périmètre : écran « Match rapide », mode entraîneur, statistiques,
  tableau tactique (restent 6×6 / 2×2 comme aujourd'hui).

### 5. Base de données — migration v16
La colonne `matches.format` a une contrainte `CHECK(format IN
('indoor_6v6','beach_2v2'))` : SQLite ne sait pas la modifier. Migration v16 :
nouvelle table `matches` identique (mêmes colonnes, même ordre) avec les
4 formats, copie de toutes les lignes, remplacement de l'ancienne, dans une
transaction. Test : toutes les lignes existantes (6×6 et 2×2) identiques après
migration.

### 6. Tests
- **6×6 inchangé** : rotation, disposition des places, règles de
  remplacement FIVB, changement de côté à 8 au set décisif, valeurs par défaut,
  reprise et annuler d'un match 6×6 type (mêmes résultats qu'avant), lignes 6×6
  intactes après migration.
- 4×4 / 3×3 / 2×2 : rotation et serveur, service alterné en 2×2,
  remplacements libres et quotas, options officielles 4×4, temps morts,
  changement de côté 7 / 5, reprise après fermeture et annuler (point,
  remplacement, temps mort), création du match depuis la configuration.
