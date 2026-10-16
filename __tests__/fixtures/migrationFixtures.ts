// Shared row fixtures representing data that existed in a real database
// BEFORE migrations v9/v10 ran (i.e. a database still at user_version = 8).
// Used by both database-migrations.test.ts (migration safety) and
// post-migration-reads.test.ts (services can still read the result).

export const V8_MATCH_ROW = {
  id: 'm1', date: '2026-01-01', format: 'indoor_6v6', mode: 'competition',
  team_home_id: 't1', team_away_id: 't2', status: 'live', config_json: '{"pointsPerSet":25}',
  winner_team_id: null, first_serve_team_id: 't1', created_at: '2026-01-01', finished_at: null,
};

export const V8_SET_ROW = {
  id: 's1', match_id: 'm1', set_number: 1, score_home: 10, score_away: 8,
  winner_team_id: null, started_at: '2026-01-01', finished_at: null,
};

export const V8_EVENT_ROW = {
  id: 'e1', match_id: 'm1', set_id: 's1', event_type: 'point_home', player_id: null,
  team_id: 't1', timestamp: '2026-01-01', details_json: '{}', is_cancelled: 0,
};

export const V8_SUBSTITUTION_PAIR_ROW = {
  id: 'p1', match_id: 'm1', set_id: 's1', team_id: 't1',
  player_out_id: 'P1', player_in_id: 'P2', is_libero: 0, is_cancelled: 0,
};

export const V8_TEAM_ROW = {
  id: 't1', name: 'Les Aigles', short_name: 'AIG', logo_uri: null, color: '#1D4ED8',
  created_at: '2026-01-01', updated_at: '2026-01-01',
};
