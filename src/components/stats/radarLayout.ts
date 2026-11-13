/**
 * Radar geometry: the radius is the largest one that keeps every label whole
 * inside the drawing, whatever the language (labels are measured, not cut).
 */

/** Conservative width of a label in Inter (wide CJK and kana counted as one em). */
export function estimateTextWidth(text: string, fontSize: number): number {
  let em = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0)!;
    if (code >= 0x2e80) em += 1;
    else if (/[A-ZÀ-ÖØ-ÞА-ЯЁ]/.test(ch)) em += 0.7;
    else if (/[mwMWшщжмюыф]/.test(ch)) em += 0.8;
    else if (/[il.,'|ı]/.test(ch)) em += 0.3;
    else em += 0.6;
  }
  return em * fontSize;
}

export type Anchor = 'start' | 'middle' | 'end';

export interface RadarLabel {
  x: number;
  /** Text baseline */
  y: number;
  anchor: Anchor;
  /** Box the label takes, for checks */
  box: { left: number; right: number; top: number; bottom: number };
}

export interface RadarLayout {
  cx: number;
  cy: number;
  r: number;
  labels: RadarLabel[];
}

const GAP = 6;
const MARGIN = 2;

export const angleOf = (i: number, n: number) => (2 * Math.PI * i) / n - Math.PI / 2;

function placeLabels(labels: string[], cx: number, cy: number, r: number, fontSize: number): RadarLabel[] {
  return labels.map((label, i) => {
    const a = angleOf(i, labels.length);
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    const px = cx + (r + GAP) * cos;
    const py = cy + (r + GAP) * sin;
    const anchor: Anchor = Math.abs(cos) < 0.15 ? 'middle' : cos > 0 ? 'start' : 'end';
    const y = sin < -0.15 ? py : sin > 0.15 ? py + fontSize * 0.8 : py + fontSize * 0.35;
    const w = estimateTextWidth(label, fontSize);
    const left = anchor === 'start' ? px : anchor === 'end' ? px - w : px - w / 2;
    return { x: px, y, anchor, box: { left, right: left + w, top: y - fontSize * 0.8, bottom: y + fontSize * 0.25 } };
  });
}

function fits(labels: RadarLabel[], width: number, height: number): boolean {
  return labels.every(({ box }) => box.left >= MARGIN && box.right <= width - MARGIN
    && box.top >= MARGIN && box.bottom <= height - MARGIN);
}

/** Layout in a width × height drawing; labels never leave it. */
export function radarLayout(labels: string[], width: number, height: number, fontSize: number): RadarLayout {
  const cx = width / 2;
  const cy = height / 2;
  let r = Math.min(width, height) / 2;
  let placed = placeLabels(labels, cx, cy, r, fontSize);
  while (r > 8 && !fits(placed, width, height)) {
    r -= 1;
    placed = placeLabels(labels, cx, cy, r, fontSize);
  }
  return { cx, cy, r, labels: placed };
}
