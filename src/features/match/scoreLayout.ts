/**
 * Size of a team's score square so that the team name, the square and the
 * "−1" / "+1" badges all fit in the column the screen leaves it.
 *
 * On a small phone (Galaxy S7, 360 × 640 dp) the point attribution panel takes
 * about 200 dp after each point: a fixed 140 dp square then spilled over the
 * set tabs and under the service bar.
 */
export const SCORE_BUTTON_MAX = 140;
/** Still a comfortable touch target */
export const SCORE_BUTTON_MIN = 56;

const NAME_HEIGHT = 18;
const BADGES_HEIGHT = 32;
const GAP = 12;
const GAP_COMPACT = 6;

export interface ScoreButtonFit {
  size: number;
  /** null until the column is measured: keep the responsive font size */
  fontSize: number | null;
  /** Smaller gaps between name, square and badges */
  compact: boolean;
}

/** Height taken by the name, the badges and the gaps around the square */
export function scoreButtonOverhead(compact: boolean): number {
  return NAME_HEIGHT + BADGES_HEIGHT + 2 * (compact ? GAP_COMPACT : GAP);
}

export function fitScoreButton(column: { width: number; height: number } | null): ScoreButtonFit {
  if (!column) return { size: SCORE_BUTTON_MAX, fontSize: null, compact: false };
  const roomy = column.height - scoreButtonOverhead(false) >= SCORE_BUTTON_MAX;
  const compact = !roomy;
  const available = Math.min(SCORE_BUTTON_MAX, column.width, column.height - scoreButtonOverhead(compact));
  const size = Math.max(SCORE_BUTTON_MIN, Math.floor(available));
  return { size, fontSize: Math.round(size * 0.6), compact };
}
