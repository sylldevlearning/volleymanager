import { LIBERO_PRESET_COLORS, PRESET_TEAM_COLORS } from '../../utils/constants';

/** Libero jersey colours offered in the match setup: libero presets first, then the team colours */
export const LIBERO_COLOR_CHOICES: string[] = [...new Set([...LIBERO_PRESET_COLORS, ...PRESET_TEAM_COLORS])];

/** First preset libero colour that differs from the team's own jersey colour. */
export function defaultLiberoColor(teamColor: string): string {
  return LIBERO_COLOR_CHOICES.find((c) => c !== teamColor) ?? LIBERO_PRESET_COLORS[0];
}

/** The chosen libero colour, unless it is the team's colour (then the distinct default). */
export function resolveLiberoColor(chosen: string | null, teamColor: string): string {
  return chosen && chosen !== teamColor ? chosen : defaultLiberoColor(teamColor);
}
