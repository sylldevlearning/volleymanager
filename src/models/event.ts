export type PointEventType = 'point_home' | 'point_away';

export type ManagementEventType =
  | 'timeout_home'
  | 'timeout_away'
  | 'substitution_home'
  | 'substitution_away'
  | 'rotation_home'
  | 'rotation_away'
  | 'undo'
  | 'set_end'
  | 'match_end';

export type StatEventType =
  | 'serve_ace'
  | 'serve_fault'
  | 'serve_in'
  | 'attack_kill'
  | 'attack_fault'
  | 'attack_defended'
  | 'block_kill'
  | 'block_touch'
  | 'block_fault'
  | 'reception_a'
  | 'reception_b'
  | 'reception_c'
  | 'reception_d'
  | 'defense_success'
  | 'defense_fault'
  | 'set_perfect'
  | 'set_good'
  | 'set_bad';

export type EventType = PointEventType | ManagementEventType | StatEventType;

export interface MatchEvent {
  id: string;
  matchId: string;
  setId: string;
  eventType: EventType;
  playerId: string | null;
  teamId: string | null;
  timestamp: string;
  details: Record<string, unknown>;
  isCancelled: boolean;
}

export type MatchEventInput = Pick<
  MatchEvent,
  'matchId' | 'setId' | 'eventType' | 'playerId' | 'teamId' | 'details'
>;

export interface Lineup {
  id: string;
  matchId: string;
  setId: string;
  teamId: string;
  playerId: string;
  position: 1 | 2 | 3 | 4 | 5 | 6;
  isStarter: boolean;
  isLibero: boolean;
}
