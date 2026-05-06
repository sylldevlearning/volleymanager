# Plan Phase 1 — Setup Projet VolleyManager

## Objectif
Initialiser un projet Expo SDK 52+ fonctionnel avec toute la stack technique configurée :
Expo Router v4, Tamagui design system (dark PSG), Zustand, expo-sqlite, react-i18next, Reanimated 3.

## APIs Autorisées (confirmées Phase 0 Discovery)

### Expo SDK 52 / Expo Router v4
- Init : `npx create-expo-app@latest --template tabs`
- Imports : `import { Stack, Tabs, useRouter, useLocalSearchParams, Link } from 'expo-router'`
- ⚠️ BREAKING v4 : `router.navigate()` = alias de `push()`. Utiliser `router.back()` / `router.dismissTo()` pour revenir
- Haptics : `import * as Haptics from 'expo-haptics'`
- Fonts : `import { useFonts } from 'expo-font'`

### Tamagui (version ≥ 1.120, toutes @tamagui/* identiques)
- Packages : `tamagui @tamagui/core @tamagui/config @tamagui/babel-plugin @tamagui/metro-plugin @tamagui/expo-font-inter`
- Babel plugin : `@tamagui/babel-plugin` avec `disableExtraction: process.env.NODE_ENV === 'development'`
- Metro : `withTamagui(config, { components: ['tamagui'], config: './tamagui.config.ts' })`
- Config : `createTamagui`, `createTokens`, `createTheme`, `createFont` from `'tamagui'`
- Provider : `<TamaguiProvider config={tamaguiConfig} defaultTheme="dark">`
- Components : `XStack, YStack, Text, Button, Card, Sheet` from `'tamagui'`

### expo-sqlite (async API, SDK 52)
- `openDatabaseAsync`, `execAsync`, `getAllAsync`, `getFirstAsync`, `runAsync`, `prepareAsync`
- Transactions exclusives : `withExclusiveTransactionAsync`
- Migrations : PRAGMA user_version pattern

### Zustand v5
- `create` from `'zustand'` + `persist`, `createJSONStorage` from `'zustand/middleware'`
- Hydration async : vérifier `_hasHydrated` avant render

### Reanimated 3 + Gesture Handler
- Babel plugin inclus dans `babel-preset-expo` (pas de config manuelle)
- `useSharedValue`, `useAnimatedStyle`, `withSpring`, `withTiming`, `withSequence`
- `GestureDetector`, `Gesture.Tap()` pour press animations
- `GestureHandlerRootView` obligatoire dans root layout

### react-i18next
- `i18next react-i18next expo-localization`
- Init : `i18n.use(initReactI18next).init({ resources: { fr, en }, lng: ..., fallbackLng: 'en' })`
- Usage : `const { t } = useTranslation()`

## Composants à créer / modifier

### Fichiers de config
- `app.config.ts` — config Expo (prioritaire sur app.json)
- `babel.config.js` — Tamagui babel plugin + reanimated
- `metro.config.js` — withTamagui
- `tsconfig.json` — strict mode
- `tamagui.config.ts` — design system complet PSG-dark
- `src/theme/tokens.ts` — palette couleurs + typographie
- `src/i18n/index.ts` + `fr.json` + `en.json`

### Structure navigation
- `app/_layout.tsx` — Root layout (GestureHandlerRootView + TamaguiProvider + Stack)
- `app/(tabs)/_layout.tsx` — Bottom tabs (Home, Matches, Teams, Settings)
- `app/(tabs)/index.tsx` — Accueil
- `app/(tabs)/matches.tsx` — Liste matchs
- `app/(tabs)/teams.tsx` — Gestion équipes
- `app/(tabs)/settings.tsx` — Paramètres

## Cas limites identifiés
- Version mismatch Tamagui : tous les @tamagui/* doivent être identiques
- `router.navigate()` cassé en v4 → `router.push()`/`router.back()`
- Zustand v5 : état initial non persisté au démarrage, vérifier hydration
- `expo-sqlite/legacy` supprimé en SDK 52 : utiliser uniquement l'API async
- `GestureHandlerRootView` doit envelopper tout l'arbre avant `TamaguiProvider`

## Critères de succès
- [ ] `npx expo start` se lance sans erreur
- [ ] Navigation bottom tabs fonctionne (4 onglets)
- [ ] Fond #0D1117 visible sur l'écran d'accueil
- [ ] Aucune erreur TypeScript en strict mode
- [ ] Fonts Inter chargées correctement
