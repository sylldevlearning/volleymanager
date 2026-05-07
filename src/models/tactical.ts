import type { MatchFormat } from './match';

export interface PlayerPosition {
  playerId: string;
  x: number;
  y: number;
  teamId: string;
  number: number;
  label: string;
  isHome: boolean;
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
  | 'eraser';

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
