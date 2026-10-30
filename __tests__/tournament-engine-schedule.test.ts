import { scheduleMatches, restSlotsFor, slotStart } from '../src/features/tournament/engine/scheduler';
import { recordResult } from '../src/features/tournament/engine/cascade';
import type { EngineMatch } from '../src/features/tournament/engine/types';
import { build, teamsOf } from './helpers/tournamentFixtures';

/** Times a team plays two slots in a row. */
function backToBack(matches: EngineMatch[]): number {
  const slots = new Map<string, number[]>();
  for (const m of matches) for (const t of teamsOf(m)) slots.set(t, [...(slots.get(t) ?? []), m.slot!]);
  let count = 0;
  for (const list of slots.values()) {
    list.sort((a, b) => a - b);
    for (let i = 1; i < list.length; i++) if (list[i] === list[i - 1] + 1) count++;
  }
  return count;
}

describe('rest', () => {
  it('a rest of a few minutes = at least one slot off', () => {
    expect(restSlotsFor({ courts: 2, startTime: '09:00', matchMinutes: 45, restMinutes: 10 })).toBe(1);
    expect(restSlotsFor({ courts: 2, startTime: '09:00', matchMinutes: 30, restMinutes: 45 })).toBe(2);
    expect(restSlotsFor({ courts: 2, startTime: '09:00', matchMinutes: 30, restMinutes: 0 })).toBe(0);
  });

  it('respected when the planning allows it', () => {
    // 2 pools of 4 on one court: pools alternate, nobody plays twice in a row
    const { matches } = build('pools_knockout', 8, { courts: 1, restSlots: 1 });
    expect(backToBack(matches.filter((m) => m.stage === 'pool'))).toBe(0);
  });

  it('relaxed rather than leaving a court empty for a whole slot', () => {
    // 3 teams, one court: someone must play twice in a row
    const { matches } = build('round_robin', 3, { courts: 1, restSlots: 1 });
    expect(matches.map((m) => m.slot)).toEqual([0, 1, 2]);
  });

  it('without rest, matches follow each other as soon as possible', () => {
    const { matches } = build('round_robin', 4, { courts: 2, restSlots: 0 });
    expect(Math.max(...matches.map((m) => m.slot!))).toBe(2);
  });

  it('with more courts, the planning is shorter', () => {
    const one = build('pools_knockout', 16, { courts: 1 }).matches;
    const four = build('pools_knockout', 16, { courts: 4 }).matches;
    expect(Math.max(...four.map((m) => m.slot!))).toBeLessThan(Math.max(...one.map((m) => m.slot!)));
  });
});

describe('slot times', () => {
  it('slot n starts n × duration after the start', () => {
    const s = { courts: 2, startTime: '09:00', matchMinutes: 45, restMinutes: 10 };
    expect(slotStart(s, 0)).toBe('09:00');
    expect(slotStart(s, 3)).toBe('11:15');
    expect(slotStart({ ...s, startTime: '23:30' }, 1)).toBe('00:15');
  });
});

describe('regeneration never overwrites a validated result', () => {
  it('reschedule keeps validated and live matches where they are', () => {
    const built = build('pools_knockout', 8, { courts: 2 });
    const first = built.matches.find((m) => m.slot === 0)!;
    const outcome = recordResult(built.ctx, built.matches, first.key, { sets: [[25, 10], [25, 10]], forfeitId: null });
    if (!outcome.ok) throw new Error('record failed');
    const live = outcome.matches.find((m) => m.slot === 1)!;
    const withLive = outcome.matches.map((m) => (m.key === live.key ? { ...m, status: 'live' as const } : m));

    // One court less: the rest of the planning moves, not the fixed matches
    const after = scheduleMatches(withLive, { courts: 1, restSlots: 1 });
    const kept = after.find((m) => m.key === first.key)!;
    expect(kept).toEqual(outcome.matches.find((m) => m.key === first.key));
    expect(after.find((m) => m.key === live.key)).toEqual(withLive.find((m) => m.key === live.key));
    // Nobody else on their slot and court
    for (const fixed of [kept, withLive.find((m) => m.key === live.key)!]) {
      const clash = after.filter((m) => m.key !== fixed.key && m.slot === fixed.slot && m.court === fixed.court);
      expect(clash).toEqual([]);
    }
    expect(after.filter((m) => m.status === 'scheduled').every((m) => m.court === 1)).toBe(true);
  });

  it('a team in a fixed match is not scheduled at the same time elsewhere', () => {
    const built = build('round_robin', 6, { courts: 3, restSlots: 0 });
    // Pretend the match at slot 4 on court 1 is already being played
    const pinned = built.matches.find((m) => m.slot === 4)!;
    const matches = built.matches.map((m) => (m.key === pinned.key ? { ...m, status: 'live' as const } : m));
    const after = scheduleMatches(matches, { courts: 3, restSlots: 0 });
    const sameSlot = after.filter((m) => m.slot === pinned.slot && m.key !== pinned.key).flatMap(teamsOf);
    for (const t of teamsOf(pinned)) expect(sameSlot).not.toContain(t);
  });

  it('scheduling twice gives the same planning', () => {
    const built = build('pools_knockout', 24, { courts: 4 });
    expect(scheduleMatches(built.matches, { courts: 4, restSlots: 1 })).toEqual(built.matches);
  });
});
