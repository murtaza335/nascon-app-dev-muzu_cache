import type { Fixture } from '../../types/models';
export function filterFixtures(matches: Fixture[], query: string, status: string, teamId?: string) {
  const needle = query.trim().toLocaleLowerCase();
  return matches.filter(match => (status === 'all' || match.status === status) && (!teamId || match.home_team_id === teamId || match.away_team_id === teamId) && (!needle || [match.home_name, match.away_name, match.home_team_id, match.away_team_id, match.venue].some(value => value?.toLocaleLowerCase().includes(needle)))).sort((a, b) => (a.scheduled_at || 'z').localeCompare(b.scheduled_at || 'z') || a.match_id.localeCompare(b.match_id));
}
export function groupFixtures(matches: Fixture[]) {
  const groups = new Map<string, Fixture[]>();
  for (const match of matches) {
    const key = match.scheduled_at ? new Date(match.scheduled_at).toLocaleDateString('en-PK', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : 'Date to be confirmed';
    groups.set(key, [...(groups.get(key) || []), match]);
  }
  return Array.from(groups, ([label, rows]) => ({ label, matches: rows }));
}
