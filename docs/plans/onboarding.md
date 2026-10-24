# Plan — Aide aux nouveaux utilisateurs

## Contexte
Rien n'explique l'app au premier lancement ; seuls les boutons « ? » donnent un
texte court, absents de l'arbitrage et de la composition.

## Comportement attendu
1. **Présentation** au premier lancement : 4 pages (match rapide, arbitrage,
   tableau tactique, équipes), « Passer » toujours visible, « Suivant » puis
   « C'est parti ! ». Retour Android = Passer.
2. **Bulles d'aide** au premier usage de l'écran d'arbitrage et du tableau
   tactique, une seule fois (« Suivant » / « Compris »).
3. **Paramètres → Aide → « Revoir l'aide »** : réinitialise la présentation
   ET les bulles ; la présentation s'ouvre aussitôt.
4. **Boutons « ? »** : textes relus contre les vrais gestes ; ajout sur
   l'arbitrage et la composition.

## Textes de la présentation (FR)
| # | Titre | Texte |
|---|---|---|
| 1 | Match rapide | Un seul geste pour commencer. Touchez +1 pour l'équipe qui marque. Le score, les sets et les rotations se gèrent tout seuls. |
| 2 | Arbitrage | Arbitrez un vrai match selon les règles officielles : composition de départ, remplacements, libéro, temps morts et sanctions. Le match est sauvegardé en continu, vous pouvez le reprendre à tout moment. |
| 3 | Tableau tactique | Placez vos joueurs librement, tracez les déplacements et rejouez-les étape par étape. Glissez un remplaçant sur un joueur pour l'échanger. |
| 4 | Équipes | Créez vos équipes en quelques secondes : seul le numéro est obligatoire. Importez vos joueurs depuis une photo de licence 📷. |

## Architecture
- `src/stores/settingsStore.ts` (persisté) : `hasSeenOnboarding`, `seenTips`,
  `markOnboardingSeen`, `markTipSeen`, `resetHelp`.
- `src/hooks/useSettingsHydrated.ts` : attend la réhydratation AsyncStorage
  avant de décider d'afficher quoi que ce soit (pas de flash).
- `src/features/onboarding/slides.ts` : définition des pages (clés i18n + icône).
- `app/onboarding.tsx` : pager horizontal plein écran.
- `app/_layout.tsx` : redirection vers `/onboarding` tant que `hasSeenOnboarding` est faux.
- `src/components/ui/CoachMarks.tsx` : bulles ancrées sur des éléments mesurés.
- `app/(tabs)/settings.tsx` : section Aide.

## Tests
- `__tests__/settings-help.test.ts` : actions du store.
- `__tests__/onboarding-slides.test.ts` : ≤ 4 pages, clés présentes en FR et EN.
- `__tests__/coach-marks.test.ts` : étapes des bulles, clés i18n FR/EN.
