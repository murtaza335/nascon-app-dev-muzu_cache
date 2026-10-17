import type { Role } from '../types/models';
import type { TabParams } from './routes';
export function tabsForRole(role: Role): (keyof TabParams)[] {
  return ['Fixtures', 'Standings', 'Store', 'Club', ...(role === 'club_manager' ? ['Roster'] : role === 'league_organizer' ? ['Scoring'] : [])] as (keyof TabParams)[];
}
