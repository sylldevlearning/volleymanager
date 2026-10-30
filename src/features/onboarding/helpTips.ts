import type { HelpTipId } from '../../stores/settingsStore';

/** First-use bubbles per screen, in display order (texts: `tips.<screen>.<step>`) */
export const HELP_TIPS = {
  arbitrage: ['score', 'sides', 'actions', 'undo'],
  tactical: ['court', 'bench', 'tools', 'steps'],
  tournament: ['tabs', 'phases', 'matches', 'menu'],
} as const satisfies Record<HelpTipId, readonly string[]>;

export type HelpTipStep<T extends HelpTipId> = (typeof HELP_TIPS)[T][number];

export function tipTextKey(id: HelpTipId, step: string): string {
  return `tips.${id}.${step}`;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BubblePlacement {
  top: number;
  left: number;
  width: number;
  placement: 'above' | 'below' | 'center';
}

const GUTTER = 16;
const GAP = 12;
const MAX_WIDTH = 320;

/** Bubble goes below the target when it fits, otherwise above, otherwise centred. */
export function placeBubble(
  target: Rect | null,
  screen: { width: number; height: number },
  bubbleHeight: number,
): BubblePlacement {
  const width = Math.min(screen.width - GUTTER * 2, MAX_WIDTH);
  const centred: BubblePlacement = {
    top: (screen.height - bubbleHeight) / 2,
    left: (screen.width - width) / 2,
    width,
    placement: 'center',
  };
  if (!target) return centred;

  const left = Math.min(
    Math.max(target.x + target.width / 2 - width / 2, GUTTER),
    screen.width - GUTTER - width,
  );
  const below = target.y + target.height + GAP;
  const above = target.y - GAP - bubbleHeight;
  const targetInTopHalf = target.y + target.height / 2 < screen.height / 2;

  const fitsBelow = below + bubbleHeight <= screen.height - GUTTER;
  const fitsAbove = above >= GUTTER;

  if (targetInTopHalf && fitsBelow) return { top: below, left, width, placement: 'below' };
  if (fitsAbove) return { top: above, left, width, placement: 'above' };
  if (fitsBelow) return { top: below, left, width, placement: 'below' };
  return centred;
}
