import type { FreehandPath } from '../../models/tactical';

/** The court is twice as tall as it is wide. */
export const COURT_ASPECT = 2;
export const MIN_COURT_WIDTH = 80;
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;

/** Largest court with its proportions in the room available. */
export function fitCourt(areaW: number, areaH: number): { w: number; h: number } {
  const w = Math.max(MIN_COURT_WIDTH, Math.min(areaW, areaH / COURT_ASPECT));
  return { w, h: w * COURT_ASPECT };
}

export function clampZoom(scale: number): number {
  'worklet';
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, scale));
}

/** Two-finger move: the zoomed court never leaves its frame (no move at 1×). */
export function clampPan(tx: number, ty: number, scale: number, w: number, h: number): { tx: number; ty: number } {
  'worklet';
  const maxX = ((scale - 1) * w) / 2;
  const maxY = ((scale - 1) * h) / 2;
  // + 0 turns -0 into 0
  return { tx: Math.min(maxX, Math.max(-maxX, tx)) + 0, ty: Math.min(maxY, Math.max(-maxY, ty)) + 0 };
}

export interface ZoomState {
  scale: number;
  tx: number;
  ty: number;
}

/**
 * A point of the court frame (pixels from its top-left) → the court point
 * under it, with the zoom applied around the centre then moved by (tx, ty).
 */
export function viewportToCourt(px: number, py: number, zoom: ZoomState, w: number, h: number): { x: number; y: number } {
  const cx = w / 2;
  const cy = h / 2;
  return { x: (px - cx - zoom.tx) / zoom.scale + cx, y: (py - cy - zoom.ty) / zoom.scale + cy };
}

const POINT_RE = /([ML])\s*(-?[\d.]+)\s+(-?[\d.]+)/g;

function mapPath(d: string, f: (x: number, y: number) => [string, string]): string {
  const parts: string[] = [];
  for (const m of d.matchAll(POINT_RE)) {
    const [x, y] = f(parseFloat(m[2]), parseFloat(m[3]));
    parts.push(`${m[1]} ${x} ${y}`);
  }
  return parts.join(' ');
}

/** Court pixels → court fractions (0..1): a drawing stays put whatever the court size. */
export function normalizePathD(d: string, w: number, h: number): string {
  return mapPath(d, (x, y) => [(x / w).toFixed(4), (y / h).toFixed(4)]);
}

/**
 * Points of a drawing as court fractions. Drawings saved before were in
 * pixels of the court they were drawn on (`legacy`).
 */
export function pathPoints(fp: FreehandPath, legacy: { w: number; h: number }): { x: number; y: number }[] {
  const [sx, sy] = fp.unit === 'court' ? [1, 1] : [legacy.w, legacy.h];
  return [...fp.d.matchAll(POINT_RE)].map((m) => ({ x: parseFloat(m[2]) / sx, y: parseFloat(m[3]) / sy }));
}

/** A drawing in pixels of the court as shown now. */
export function pathToPixels(fp: FreehandPath, w: number, h: number, legacy: { w: number; h: number }): string {
  const [sx, sy] = fp.unit === 'court' ? [w, h] : [w / legacy.w, h / legacy.h];
  return mapPath(fp.d, (x, y) => [(x * sx).toFixed(1), (y * sy).toFixed(1)]);
}
