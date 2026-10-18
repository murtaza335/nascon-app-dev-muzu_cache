import type { Role,ScreenData } from '../../types/models';
export function dashboardMatches(data: ScreenData, role: Role) {
  const squads = new Set((data.squads || []).filter(s => s.club_id === data.user?.club_id).map(s => s.squad_id));
  const matches = data.fixtures.filter(match => role === 'league_organizer' ? data.user?.league_ids?.includes(match.league_id) : ['club_manager', 'player'].includes(role) && squads.size ? squads.has(match.home_team_id) || squads.has(match.away_team_id) : true);
  return matches.filter(match => ['in_progress', 'upcoming'].includes(match.status)).sort((a, b) => Number(b.status === 'in_progress') - Number(a.status === 'in_progress') || (a.scheduled_at || 'z').localeCompare(b.scheduled_at || 'z'));
}
