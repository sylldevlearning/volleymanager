import type { TeamRef } from '../../../models/tournament';
import type { EngineMatch } from './types';

export interface Entrant {
  ref: TeamRef;
  /** Known pool of origin, to keep teams of a pool apart in the first round. */
  pool: number | null;
  /** Known team (pure knockout), null while it comes from a result. */
  teamId: string | null;
}

export const nextPowerOf2 = (n: number) => 2 ** Math.ceil(Math.log2(Math.max(1, n)));

/** Standard bracket order of the seeds: 1-8, 4-5, 2-7, 3-6… (1 and 2 meet in the final at the earliest). */
export function seedPositions(size: number): number[] {
  let positions = [1];
  while (positions.length < size) {
    const len = positions.length;
    positions = positions.flatMap((s) => [s, 2 * len + 1 - s]);
  }
  return positions;
}

type Slot = { kind: 'entrant'; entrant: Entrant } | { kind: 'match'; key: string };

function emptyMatch(key: string, round: number, bracketSlot: number, label: string): Omit<EngineMatch, 'homeRef' | 'awayRef' | 'homeId' | 'awayId'> {
  return {
    key, stage: 'knockout', pool: null, phase: null, level: null, round, bracketSlot, label,
    status: 'scheduled', sets: null, forfeitId: null, winnerId: null, slot: null, court: null,
  };
}

function side(slot: Slot): { ref: TeamRef; id: string | null } {
  return slot.kind === 'entrant'
    ? { ref: slot.entrant.ref, id: slot.entrant.teamId }
    : { ref: { type: 'winner', match: slot.key }, id: null };
}

/**
 * Single elimination for entrants given best seed first. The bracket is the
 * next power of 2: the best seeds get the byes and go straight to round 2.
 * Labels: 'ko:<teams in the round>:<n>', 'third' for the 3rd place match.
 */
export function buildBracket(entrants: Entrant[], opts: { thirdPlace: boolean; keyPrefix: string }): EngineMatch[] {
  const size = nextPowerOf2(entrants.length);
  const positions = seedPositions(size);
  const matches: EngineMatch[] = [];

  let slots: (Slot | null)[] = positions.map((seed) => {
    const entrant = entrants[seed - 1];
    return entrant ? { kind: 'entrant', entrant } : null;
  });

  for (let round = 1, teams = size; teams >= 2; round++, teams /= 2) {
    const next: Slot[] = [];
    let n = 0;
    for (let j = 0; j < slots.length / 2; j++) {
      const a = slots[2 * j];
      const b = slots[2 * j + 1];
      if (!a || !b) {
        // Bye: the entrant goes through
        next.push((a ?? b)!);
        continue;
      }
      const key = `${opts.keyPrefix}K${round}-${j + 1}`;
      const home = side(a);
      const away = side(b);
      matches.push({
        ...emptyMatch(key, round, j, `ko:${teams}:${++n}`),
        homeRef: home.ref, awayRef: away.ref, homeId: home.id, awayId: away.id,
      });
      next.push({ kind: 'match', key });
    }
    slots = next;
  }

  const semis = matches.filter((m) => m.label?.startsWith('ko:4:'));
  if (opts.thirdPlace && semis.length === 2) {
    const final = matches[matches.length - 1];
    matches.push({
      ...emptyMatch(`${opts.keyPrefix}T`, final.round, 0, 'third'),
      stage: 'placement',
      homeRef: { type: 'loser', match: semis[0].key },
      awayRef: { type: 'loser', match: semis[1].key },
      homeId: null,
      awayId: null,
    });
  }
  return matches;
}

/**
 * Bracket where every place is played (size = power of 2): winners go on for
 * the best places, losers play for the places below, so every team plays
 * log2(size) matches. Labels: 'place:<from>-<to>:<n>' — a 2-team match
 * decides places <from> and <to>.
 */
export function buildPlacementBracket(entrants: TeamRef[], opts: { keyPrefix: string; level: number | null }): EngineMatch[] {
  const matches: EngineMatch[] = [];
  const positions = seedPositions(entrants.length);

  const play = (slots: TeamRef[], from: number, round: number, path: string) => {
    if (slots.length < 2) return;
    const to = from + slots.length - 1;
    const winners: TeamRef[] = [];
    const losers: TeamRef[] = [];
    for (let j = 0; j < slots.length / 2; j++) {
      const key = `${opts.keyPrefix}K${path}${round}-${j + 1}`;
      matches.push({
        ...emptyMatch(key, round, j, `place:${from}-${to}:${j + 1}`),
        level: opts.level,
        homeRef: slots[2 * j], awayRef: slots[2 * j + 1],
        homeId: slots[2 * j].type === 'team' ? (slots[2 * j] as { id: string }).id : null,
        awayId: slots[2 * j + 1].type === 'team' ? (slots[2 * j + 1] as { id: string }).id : null,
      });
      winners.push({ type: 'winner', match: key });
      losers.push({ type: 'loser', match: key });
    }
    play(winners, from, round + 1, `${path}W`);
    play(losers, from + slots.length / 2, round + 1, `${path}L`);
  };

  play(positions.map((seed) => entrants[seed - 1]), 1, 1, '');
  return matches;
}
