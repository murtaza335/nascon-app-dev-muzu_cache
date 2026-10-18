import type { Role } from '../types/models';
import type { TabParams } from './routes';
export function tabsForRole(_role: Role): (keyof TabParams)[] {
  return ['Home', 'Fixtures', 'Standings', 'Store', 'Club'];
}
