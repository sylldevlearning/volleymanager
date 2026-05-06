# VolleyManager — Mémoire Projet

## Stack
Expo SDK 54 | React 19 | TypeScript strict | Tamagui v2 RC | Zustand v5 | expo-sqlite v16 (async) | Expo Router v6 | react-i18next | lucide-react-native | react-native-reanimated 4 | react-native-gesture-handler | react-native-svg | Jest + jest-expo

## Architecture
**Event-sourcing** pour les matchs. Les événements (`match_events`) sont append-only et constituent la source de vérité. Le score se recalcule toujours depuis les events non annulés. L'undo n'efface pas : il marque `is_cancelled = 1` et ajoute un event `undo`.

## Structure clé
```
app/                    # Expo Router (screens)
  (tabs)/               # Bottom tabs: index, matches, teams, settings
  match/[id]/           # referee.tsx | coach.tsx | summary.tsx
  match/new.tsx
  team/[id].tsx, new.tsx
src/
  components/           # court/, scoring/, stats/, ui/
  features/             # match/, scoring/, rotation/, stats/, teams/
  hooks/
  i18n/                 # fr.json + en.json + index.ts
  models/               # match.ts, player.ts, team.ts, event.ts, stats.ts
  services/             # database.ts, matchService, playerService, teamService, eventService, statsService
  stores/               # scoringStore.ts (Zustand), settingsStore.ts
  theme/                # tokens.ts (palette PSG dark)
  utils/                # volleyball-rules.ts, constants.ts
__tests__/              # TDD tests (volleyball-rules.test.ts)
docs/plans/             # Plan .md pour chaque feature (workflow obligatoire)
```

## Conventions de code
- **Anglais** pour le code, **i18n** pour toutes les chaînes UI (fr.json + en.json)
- **Commits conventionnels** : `feat:`, `fix:`, `refactor:`, `test:`, `docs:`
- **TDD** : tests écrits AVANT le code (Jest + jest-expo)
- **Plan** dans `docs/plans/<feature>.md` AVANT chaque feature
- **Types stricts** : pas de `any`, `strict: true` dans tsconfig
- **StyleSheet.create** pour les styles (pas de Tamagui inline styles dans les écrans natifs)
- **lucide-react-native** pour les icônes (pas de @expo/vector-icons)

## Design System
- **Dark mode PSG** par défaut : fond `#0D1117`, surfaces `#161B22`, accent rouge `#E63946`, bleu `#1D4ED8`
- Fonts : Inter (Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_900Black)
- Boutons scoring ≥ 88dp (SCORE_BUTTON_SIZE = 88)
- Feedback haptique sur chaque point (paramétrable dans Settings)

## APIs critiques
- **expo-sqlite** : utiliser UNIQUEMENT l'API async (`openDatabaseAsync`, `withExclusiveTransactionAsync`) — l'API legacy est supprimée
- **Expo Router v6** : `router.navigate()` = alias de `push()` — utiliser `router.back()` / `router.replace()` selon le besoin
- **Zustand v5** : état initial non persisté dans AsyncStorage — vérifier hydration au démarrage
- **Reanimated 4** : babel plugin inclus dans `babel-preset-expo`, pas de config manuelle nécessaire
- **Tamagui v2 RC** : tous `@tamagui/*` doivent être à la même version (`^2.0.0-rc.41`)

## Pièges connus
- `GestureHandlerRootView` doit envelopper TamaguiProvider dans `_layout.tsx`
- `accentPrimaryMuted` est `rgba(230, 57, 70, 0.12)` — pas utilisable en token Tamagui (utiliser directement)
- expo-sqlite `execAsync` ne supporte pas les paramètres — toujours utiliser `runAsync` ou `prepareAsync` pour les requêtes paramétrées
- Supprimer les fichiers template Expo (two.tsx, modal.tsx, EditScreenInfo, Themed, etc.)

## Priorité features restantes
- [ ] Composition de départ interactive (drag & drop sur terrain SVG)
- [ ] Écran statistiques détaillé avec graphiques (radar, barres)
- [ ] Filtres historique par équipe/date
- [ ] Export PDF du résumé de match
- [ ] Light mode complet
- [ ] Notifications de fin de set

## Tests
```bash
npm test                    # Run all tests
npm run test:watch          # Watch mode
npx jest __tests__/volleyball-rules.test.ts  # Rules only
```

## Démarrage
```bash
npm start                   # Expo Dev Server
npm run android             # Android
npx expo start --tunnel     # Si device physique via Expo Go
```
