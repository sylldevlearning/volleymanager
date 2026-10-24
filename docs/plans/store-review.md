# Plan — Demande de notation Google Play

## Règles
- API officielle in-app review (`expo-store-review`), affichée directement :
  **pas de question préalable** (« Aimez-vous l'app ? » est interdit par Google Play).
- Déclenchée après un moment positif : la fin **naturelle** (match gagné) d'un
  3e match terminé ou plus, arbitrage ou match rapide / nouveau match.
  Un match arrêté via « Terminer le match » ne compte pas (abandon possible).
- Au moins **3 jours** après le premier lancement.
- **Jamais pendant un match** : uniquement sur l'écran de résumé atteint juste
  après la fin (`/match/[id]/summary?justFinished=1`), pas depuis l'historique.
- **Une seule fois** : le drapeau est posé avant l'appel, même si le dialogue
  échoue ou est refusé. « Revoir l'aide » ne le réinitialise pas.
- Si l'API n'est pas disponible (pas de Play Store), on retente au match suivant.

## Date d'installation
Pas de dépendance native en plus : `firstLaunchAt` est posé au premier lancement
après hydratation des réglages. Pour les utilisateurs déjà installés, le délai de
3 jours part de la mise à jour (plus prudent, jamais plus tôt).

## Fichiers
```
src/features/review/reviewPrompt.ts   # shouldRequestReview (pur) + maybeRequestReview
src/stores/settingsStore.ts           # finishedMatchCount, countedMatchIds, firstLaunchAt, hasRequestedReview
app/_layout.tsx                       # ensureFirstLaunchAt
app/match/[id]/referee.tsx            # recordMatchFinished + justFinished
app/match/[id]/arbitrage.tsx          # idem
app/match/[id]/summary.tsx            # maybeRequestReview (1,5 s après affichage)
__tests__/reviewPrompt.test.ts
```

## Note
Google limite lui-même l'affichage (quota) : l'appel peut ne rien montrer, c'est normal.
En test, le dialogue n'apparaît que pour une app installée depuis le Play Store
(piste de test interne).
