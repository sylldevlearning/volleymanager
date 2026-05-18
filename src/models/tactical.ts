import type { MatchFormat } from './match';

export interface PlayerPosition {
  playerId: string;
  x: number;
  y: number;
  teamId: string;
  number: number;
  label: string;
  firstName?: string | null;
  lastName?: string | null;
  isHome: boolean;
  isLibero?: boolean;
  /** Special ball token — yellow, rendered as 🏐 */
  isBall?: boolean;
  /** Override the default team colour for this token (tactical board only) */
  customColor?: string;
}

export type ArrowType = 'solid' | 'dashed' | 'curved';
export type ArrowThickness = 'thin' | 'thick';

export interface Arrow {
  id: string;
  type: ArrowType;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  controlX?: number;
  controlY?: number;
  color: string;
  thickness: ArrowThickness;
  order: number;
  /** Arrows sharing the same group number animate simultaneously */
  group: number;
  /** Player touched when the arrow was drawn — follows this trajectory */
  linkedPlayerId?: string | null;
}

export type TacticalCategory =
  | 'reception'
  | 'attack'
  | 'defense'
  | 'coverage'
  | 'serve'
  | 'custom';

export type TacticalTool =
  | 'move'
  | 'arrow_solid'
  | 'arrow_dashed'
  | 'arrow_curved'
  | 'pencil'
  | 'eraser';

export interface FreehandPath {
  id: string;
  /** SVG path data string (M x y L x y ...) — coordinates in court pixels */
  d: string;
  color: string;
  /** When true, an arrowhead is drawn at the last point */
  hasArrow?: boolean;
  /** Animation group — paths in the same group animate simultaneously */
  group?: number;
  /** Player touched when the path was drawn — follows this trajectory */
  linkedPlayerId?: string | null;
}

export interface TacticalPlay {
  id: string;
  name: string;
  description?: string;
  format: MatchFormat;
  category: TacticalCategory;
  positions: PlayerPosition[];
  arrows: Arrow[];
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}
