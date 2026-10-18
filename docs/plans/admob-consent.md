# Plan — Bannières AdMob + consentement RGPD

## Contexte
Les bannières (`AdBanner`) étaient un placeholder « Publicité ». On branche le vrai
SDK `react-native-google-mobile-ads` (même intégration que Scoreboard Pro), en
bannières uniquement : pas d'interstitiel.

## Contraintes
- Consentement Google UMP **avant** toute initialisation du SDK ou requête d'annonce.
- Annonces de test partout sauf dans le build EAS `production` (évite les clics
  invalides des testeurs qui peuvent faire bannir le compte AdMob).
- Aucun identifiant réel dans le code : ils viennent des variables d'environnement EAS.
- Expo Go / web / Jest : le module natif est absent → chargement dynamique,
  aucune bannière, aucun crash.

## Fichiers
```
app.config.ts                       # plugin react-native-google-mobile-ads (App ID)
eas.json                            # environment + EXPO_PUBLIC_APP_ENV par profil
src/features/ads/adUnit.ts          # choix test / réel (pur, testé)
src/features/ads/adsService.ts      # consentement + init + store canShowAds
src/components/ads/AdBanner.tsx     # vraie bannière, rien tant que non autorisée
src/utils/constants.ts              # IDs de blocs lus depuis l'environnement
app/_layout.tsx                     # lance initAds() au démarrage
__tests__/adUnit.test.ts
```

## Variables d'environnement EAS (projet volleymanager)
| Nom | Environnements | Valeur |
|---|---|---|
| `EXPO_PUBLIC_ADMOB_ANDROID_APP_ID` | development, preview, production | `ca-app-pub-…~…` |
| `EXPO_PUBLIC_ADMOB_BANNER_HOME_ID` | production | `ca-app-pub-…/…` |
| `EXPO_PUBLIC_ADMOB_BANNER_HISTORY_ID` | production | `ca-app-pub-…/…` |
| `EXPO_PUBLIC_ADMOB_BANNER_SETTINGS_ID` | production | `ca-app-pub-…/…` |

Sans ces variables, l'app utilise les identifiants d'exemple de Google (annonces de test).
