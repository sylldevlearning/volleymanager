/**
 * The sample match, as the referee would have played it: points with the
 * players' actions, rotations, the libero in and out for the middles, regular
 * substitutions and timeouts. Pure and seeded: the same events every time.
 * Players are referred to by key (`home:7`), mapped to ids when written.
 */
import { createRng } from '../tournament/engine/rng';
import { rotateSideOnSideOut, type CourtMap, type SideCourtState } from '../../utils/courtRotation';
import { checkLiberoRallySinceLastReplacement, validateLiberoSubstitution } from '../../utils/rulesValidator';
import type { MatchEvent, StatEventType } from '../../models/event';
import type { SampleSetPlan, SampleTeam } from './sampleData';

export type Side = 'home' | 'away';

export type SampleEvent =
  | { kind: 'point'; side: Side }
  | { kind: 'stat'; type: StatEventType; side: Side; player: string }
  | { kind: 'timeout'; side: Side }
  | {
    kind: 'sub'; side: Side; playerOut: string; playerIn: string; position: number;
    isLibero: boolean; isAutomatic: boolean;
  };

export interface SampleSet {
  setNumber: number;
  serve: Side;
  lineup: Record<Side, CourtMap>;
  events: SampleEvent[];
  scoreHome: number;
  scoreAway: number;
  winner: Side;
}

export const keyOf = (side: Side, number: number) => `${side}:${number}`;

const other = (side: Side): Side => (side === 'home' ? 'away' : 'home');

/** Rally winners in order: the set winner takes the last point, never reached before. */
export function rallyOrder(plan: SampleSetPlan, rng: () => number): Side[] {
  const winner: Side = plan.home > plan.away ? 'home' : 'away';
  const loser = other(winner);
  const w = Math.max(plan.home, plan.away);
  const l = Math.min(plan.home, plan.away);
  const order: Side[] = [...Array(w - 1).fill(winner), ...Array(l).fill(loser)];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return [...order, winner];
}

/** Turns the generated events into MatchEvents for the rule validators. */
function asMatchEvents(events: SampleEvent[]): MatchEvent[] {
  return events.flatMap((e, i): MatchEvent[] => {
    const base = { id: `e${i}`, matchId: 'm', setId: 's', playerId: null, teamId: null, timestamp: '', isCancelled: false };
    if (e.kind === 'point') return [{ ...base, eventType: e.side === 'home' ? 'point_home' : 'point_away', details: {} }];
    if (e.kind === 'sub') {
      return [{ ...base, eventType: e.side === 'home' ? 'substitution_home' : 'substitution_away', playerId: e.playerIn, details: { isLibero: e.isLibero, playerOutId: e.playerOut, position: e.position } }];
    }
    return [];
  });
}

export function buildSampleSets(teams: Record<Side, SampleTeam>, plans: SampleSetPlan[], seed: number): SampleSet[] {
  const rng = createRng(seed);
  const pick = <T,>(list: T[]): T => list[Math.floor(rng() * list.length)];
  const positionOf = (side: Side, number: number) => teams[side].players.find((p) => p.number === number)!.position;
  const liberoOf = (side: Side) => keyOf(side, teams[side].players.find((p) => p.position === 'libero')!.number);
  const numberOf = (key: string) => Number(key.split(':')[1]);

  return plans.map((plan, index) => {
    const lineup: Record<Side, CourtMap> = { home: {}, away: {} };
    const state: Record<Side, SideCourtState> = { home: null!, away: null! };
    for (const side of ['home', 'away'] as const) {
      for (const [pos, number] of Object.entries(teams[side].lineup)) lineup[side][Number(pos)] = keyOf(side, number);
      state[side] = {
        onCourt: { ...lineup[side] },
        rotation: [1, 2, 3, 4, 5, 6],
        libero: { liberoId: liberoOf(side), isOnCourt: false, replacedPlayerId: null, replacedPosition: null },
      };
    }
    const events: SampleEvent[] = [];
    let serving: Side = plan.serve;
    const score = { home: 0, away: 0 };
    const pendingTimeouts = [...plan.timeouts];
    const pendingSubs = [...plan.subs];

    const onCourtAt = (side: Side, positions: number[], role?: string[]) =>
      positions.map((p) => state[side].onCourt[p]).filter((k) => k && k !== liberoOf(side)
        && (!role || role.includes(positionOf(side, numberOf(k)))));

    for (const winner of rallyOrder(plan, rng)) {
      const total = score.home + score.away;

      for (const t of pendingTimeouts.filter((x) => x.at === total)) events.push({ kind: 'timeout', side: t.side });
      for (const s of pendingSubs.filter((x) => x.at === total)) {
        const out = keyOf(s.side, s.out);
        const position = Number(Object.entries(state[s.side].onCourt).find(([, k]) => k === out)![0]);
        events.push({ kind: 'sub', side: s.side, playerOut: out, playerIn: keyOf(s.side, s.in), position, isLibero: false, isAutomatic: false });
        state[s.side] = { ...state[s.side], onCourt: { ...state[s.side].onCourt, [position]: keyOf(s.side, s.in) } };
      }

      // The libero comes in for a middle in the back row (never to serve)
      for (const side of ['home', 'away'] as const) {
        if (state[side].libero!.isOnCourt) continue;
        const spot = [6, 5].find((p) => {
          const k = state[side].onCourt[p];
          return k && positionOf(side, numberOf(k)) === 'middle';
        });
        if (!spot) continue;
        if (!validateLiberoSubstitution(spot, serving === side).ok) continue;
        if (!checkLiberoRallySinceLastReplacement(asMatchEvents(events), side).ok) continue;
        const middle = state[side].onCourt[spot];
        events.push({ kind: 'sub', side, playerOut: middle, playerIn: liberoOf(side), position: spot, isLibero: true, isAutomatic: false });
        state[side] = {
          ...state[side],
          onCourt: { ...state[side].onCourt, [spot]: liberoOf(side) },
          libero: { ...state[side].libero!, isOnCourt: true, replacedPlayerId: middle, replacedPosition: spot },
        };
      }

      // The rally: the server, the reception, the decisive action
      const receiving = other(serving);
      const server = state[serving].onCourt[1];
      const roll = rng();
      if (roll < 0.08 && winner === serving) {
        events.push({ kind: 'stat', type: 'serve_ace', side: serving, player: server });
      } else if (roll < 0.14 && winner === receiving) {
        events.push({ kind: 'stat', type: 'serve_fault', side: serving, player: server });
      } else {
        events.push({ kind: 'stat', type: 'serve_in', side: serving, player: server });
        const receivers = [liberoOf(receiving), ...onCourtAt(receiving, [5, 6, 1], ['outside'])]
          .filter((k) => Object.values(state[receiving].onCourt).includes(k));
        const quality = winner === receiving ? pick(['reception_a', 'reception_a', 'reception_b'] as const) : pick(['reception_b', 'reception_c'] as const);
        if (receivers.length > 0) events.push({ kind: 'stat', type: quality, side: receiving, player: pick(receivers) });
        const attackers = onCourtAt(winner, [2, 3, 4], ['outside', 'opposite', 'middle']);
        const blockers = onCourtAt(winner, [2, 3, 4], ['middle', 'opposite', 'outside']);
        const loserAttackers = onCourtAt(other(winner), [2, 3, 4], ['outside', 'opposite', 'middle']);
        const r = rng();
        if (r < 0.62 && attackers.length) {
          events.push({ kind: 'stat', type: 'attack_kill', side: winner, player: pick(attackers) });
        } else if (r < 0.78 && blockers.length) {
          events.push({ kind: 'stat', type: 'block_kill', side: winner, player: pick(blockers) });
        } else if (loserAttackers.length) {
          events.push({ kind: 'stat', type: 'attack_fault', side: other(winner), player: pick(loserAttackers) });
        }
        const defenders = [5, 6, 1].map((p) => state[winner].onCourt[p]).filter(Boolean);
        if (rng() < 0.3 && defenders.length) events.push({ kind: 'stat', type: 'defense_success', side: winner, player: pick(defenders) });
      }

      events.push({ kind: 'point', side: winner });
      score[winner]++;
      if (winner !== serving) {
        const { state: next, autoExit } = rotateSideOnSideOut(winner, state[winner]);
        state[winner] = next;
        if (autoExit) {
          events.push({
            kind: 'sub', side: winner, playerOut: autoExit.liberoId, playerIn: autoExit.replacedPlayerId,
            position: autoExit.position, isLibero: true, isAutomatic: true,
          });
        }
      }
      serving = winner;
    }

    return {
      setNumber: index + 1,
      serve: plan.serve,
      lineup,
      events,
      scoreHome: score.home,
      scoreAway: score.away,
      winner: score.home > score.away ? 'home' : 'away',
    };
  });
}
