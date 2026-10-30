import { createAdHocTeam } from './teamService';
import { createMatch } from './matchService';
import type { Match } from '../models/match';
import { quickMatchConfig, type MatchQr, type MatchQrTeam } from '../features/tournament/matchQr';

function createSide(team: MatchQrTeam) {
  // Kept out of "Mes équipes", like the arbitrage teams
  return createAdHocTeam({ name: team.name, shortName: null, logoUri: null, color: team.color });
}

/** Quick match filled from a scanned match QR: these teams, this format, these rules. */
export async function createMatchFromQr(qr: MatchQr): Promise<Match> {
  const [home, away] = await Promise.all([createSide(qr.home), createSide(qr.away)]);
  return createMatch({
    format: qr.format,
    mode: 'leisure',
    teamHomeId: home.id,
    teamAwayId: away.id,
    config: quickMatchConfig(qr),
  });
}
