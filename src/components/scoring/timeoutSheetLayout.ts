/**
 * Size of the timeout card and its countdown for the current window: 300 dp and
 * 72 on most phones, narrower and smaller on small or short screens.
 */
const CARD_WIDTH = 300;
const CARD_MARGIN = 32;
const TIMER_FONT = 72;
const REFERENCE_WIDTH = 360;
const REFERENCE_HEIGHT = 640;

export interface TimeoutSheetLayout {
  cardWidth: number;
  timerFontSize: number;
  timerLineHeight: number;
}

export function timeoutSheetLayout(window: { width: number; height: number }): TimeoutSheetLayout {
  const cardWidth = Math.min(CARD_WIDTH, window.width - 2 * CARD_MARGIN);
  const scale = Math.min(1, window.width / REFERENCE_WIDTH, window.height / REFERENCE_HEIGHT);
  const timerFontSize = Math.round(TIMER_FONT * scale);
  return { cardWidth, timerFontSize, timerLineHeight: Math.round(timerFontSize * 1.11) };
}
