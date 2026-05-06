# 🏐 VolleyManager

Application mobile React Native de gestion de match de volley-ball pour arbitres et entraîneurs. Dark mode premium, design inspiré de l'app PSG.

## Fonctionnalités

### Mode Arbitre
- Scoring live en temps réel (tap pour ajouter un point)
- Règles FIVB automatiques (indoor 6v6, beach 2v2, loisir)
- Détection automatique fin de set et fin de match
- Gestion des temps morts (avec compteur visuel)
- Bouton Undo (annulation du dernier point)
- Suivi des rotations (P1 → serveur)
- Chronomètre par set
- Feedback haptique à chaque point
- Indicateur de service animé

### Mode Entraîneur
- Statistiques joueurs en live (ace, faute, attaque, block, réception, défense, passe)
- Sélection rapide du joueur par tap
- Compteur par catégorie en temps réel
- Dashboard post-match avec efficacités (%)

### Gestion
- CRUD équipes (nom, couleur, abbréviation)
- CRUD joueurs (prénom, nom, numéro, poste)
- Historique des matchs
- Résumé post-match avec statistiques détaillées
- Paramètres (langue FR/EN, dark/light mode, haptics)

## Stack technique

| Technologie | Version | Usage |
|---|---|---|
| Expo | ~54.0 | Framework React Native |
| React | 19.1 | UI |
| TypeScript | ~5.9 | Strict mode |
| Expo Router | ~6.0 | Navigation file-based |
| Tamagui | ^2.0.0-rc | Design system |
| Zustand | ^5.0 | State management |
| expo-sqlite | ~16.0 | Base de données locale |
| react-i18next | ^17.0 | Internationalisation |
| Reanimated | ~4.1 | Animations |
| Gesture Handler | ~2.28 | Interactions tactiles |
| Jest + jest-expo | | Tests |

## Installation

```bash
# Cloner le projet
git clone <repo-url>
cd app-volleyball

# Installer les dépendances
npm install

# Démarrer le serveur de développement
npm start

# Android
npm run android

# iOS (macOS uniquement)
npm run ios
```

### Prérequis
- Node.js 18+
- npm 9+
- Android Studio (pour émulateur Android) ou Expo Go (device physique)
- Java 17+ (pour builds Android)

## Tests

```bash
npm test                    # Tous les tests
npm run test:watch          # Mode watch
```

Tests inclus :
- Règles FIVB (isSetWon, isMatchWon, rotations, timeouts, etc.) — 36 tests

## Architecture

```
app/                   # Expo Router screens
  (tabs)/              # Bottom tabs
  match/[id]/          # referee | coach | summary
src/
  models/              # Types TypeScript
  services/            # Couche DAO SQLite
  stores/              # Zustand stores
  components/          # UI components
  utils/               # volleyball-rules, constants
  i18n/                # Traductions FR + EN
  theme/               # Design tokens PSG dark
__tests__/             # Tests unitaires
docs/plans/            # Plans de features (workflow)
```

### Event-Sourcing
Les événements de match sont **append-only** (immuables). Le score est toujours recalculé depuis les événements non annulés. L'undo n'efface pas — il marque l'événement comme annulé et ajoute un événement `undo`.

## Formats de jeu

| Format | Sets gagnants | Points/set | Dernier set | Spécificités |
|---|---|---|---|---|
| Indoor 6v6 | 3 | 25 pts | 15 pts | Rotations, libéro, 6 remplac. |
| Beach 2v2 | 2 | 21 pts | 15 pts | Changement de côté tous les 7 pts |
| Loisir | Configurable | Configurable | Configurable | Tout illimité |

## Design

Dark mode inspiré de l'app officielle PSG :
- Fond : `#0D1117` (navy profond)
- Surfaces : `#161B22`
- Accent rouge : `#E63946` (points, actions critiques)
- Accent bleu : `#1D4ED8` (navigation, domicile)
- Typographie : Inter (400 → 900)

## Contribution

Workflow obligatoire pour chaque feature :
1. **PLAN** → `docs/plans/<feature>.md`
2. **TESTS** → `__tests__/<feature>.test.ts` (TDD)
3. **CODE** → Implémentation
4. **REVIEW** → Relecture (types, performance, accessibilité)
5. **COMMIT** → Message conventionnel (`feat:`, `fix:`, `test:`, etc.)
