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
  /** SVG path data string (M x y L x y ...) */
  d: string;
  color: string;
  /** When true, an arrowhead is drawn at the last point */
  hasArrow?: boolean;
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
