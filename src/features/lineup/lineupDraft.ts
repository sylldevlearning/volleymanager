import type { Player } from '../../models/player';
import type { LiberoState } from '../../models/substitution';
import type { CourtMap } from '../../stores/scoringStore';

export interface SideLineup {
  courtMap: CourtMap;
  bench: Player[];
  liberoState: LiberoState | null;
}

export interface FullLineup {
  home: SideLineup;
  away: SideLineup;
}

let _draft: FullLineup | null = null;

export function setLineupDraft(draft: FullLineup): void {
  _draft = draft;
}

export function takeLineupDraft(): FullLineup | null {
  const draft = _draft;
  _draft = null;
  return draft;
}
