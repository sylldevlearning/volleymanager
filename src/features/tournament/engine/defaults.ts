import type {
  PointsScale,
  PoolRules,
  SetRules,
  TiebreakerRule,
  TournamentFormat,
  TournamentGameType,
  TournamentRules,
  TournamentSchedule,
} from '../../../models/tournament';

export const DEFAULT_POINTS: PointsScale = { winClear: 3, winTight: 2, lossTight: 1, lossClear: 0, forfeitLoss: 0 };
export const DEFAULT_TIEBREAKERS: TiebreakerRule[] = ['setQuotient', 'pointQuotient', 'headToHead'];

const SET_RULES: Record<TournamentGameType, SetRules> = {
  indoor_6v6: { setsToWin: 2, pointsPerSet: 25, pointsLastSet: 15, winMargin: 2, tieBreak: true },
  indoor_4v4: { setsToWin: 2, pointsPerSet: 21, pointsLastSet: 15, winMargin: 2, tieBreak: true },
  indoor_3v3: { setsToWin: 1, pointsPerSet: 21, pointsLastSet: 15, winMargin: 2, tieBreak: false },
  beach_2v2: { setsToWin: 2, pointsPerSet: 21, pointsLastSet: 15, winMargin: 2, tieBreak: true },
};

/** Estimated slot length, changeover included. */
const MATCH_MINUTES: Record<TournamentGameType, number> = {
  indoor_6v6: 45,
  indoor_4v4: 30,
  indoor_3v3: 20,
  beach_2v2: 35,
};

export function defaultSetRules(gameType: TournamentGameType): SetRules {
  return { ...SET_RULES[gameType] };
}

export function recommendFormat(teamCount: number): TournamentFormat {
  return teamCount <= 6 ? 'round_robin' : 'pools_knockout';
}

const isPowerOf2 = (n: number) => n > 0 && (n & (n - 1)) === 0;
const nextPowerOf2 = (n: number) => 2 ** Math.ceil(Math.log2(Math.max(1, n)));

/** Pools of about 4, top 2 qualified, best thirds to fill a full bracket when possible. */
export function defaultPoolRules(teamCount: number): PoolRules {
  if (teamCount < 6) return { count: 1, qualifiersPerPool: Math.min(4, teamCount), bestOthers: 0 };
  const count = Math.round(teamCount / 4);
  const direct = count * 2;
  const missing = isPowerOf2(direct) ? 0 : nextPowerOf2(direct) - direct;
  // One extra team per pool at most — otherwise byes complete the bracket
  return { count, qualifiersPerPool: 2, bestOthers: missing <= count ? missing : 0 };
}

export function defaultRules(gameType: TournamentGameType, format: TournamentFormat, teamCount: number): TournamentRules {
  return {
    match: defaultSetRules(gameType),
    finalsMatch: null,
    points: { ...DEFAULT_POINTS },
    tiebreakers: [...DEFAULT_TIEBREAKERS],
    pools: format === 'pools_knockout' ? defaultPoolRules(teamCount) : null,
    knockout: { thirdPlace: true },
    roundRobinLegs: 1,
  };
}

export function defaultSchedule(gameType: TournamentGameType, teamCount: number): TournamentSchedule {
  return {
    courts: Math.min(12, Math.max(1, Math.ceil(teamCount / 6))),
    startTime: '09:00',
    matchMinutes: MATCH_MINUTES[gameType],
    restMinutes: 10,
  };
}
