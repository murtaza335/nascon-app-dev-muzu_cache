import { createMockData } from '../../../tests/fixtures/mockData';
import { getPreviewData } from '../../app/previewData';
import type { Role, ScreenData } from '../../types/preview';

export const demoPassword = 'DemoPass123!';
export const demoRoles: Role[] = ['viewer', 'player', 'club_manager', 'league_organizer', 'super_admin'];
export const demoAccounts = demoRoles.map(role => ({ ...createMockData().api.me_by_role[role].user }));

/** Synthetic local server seed, never a production response or sport catalogue. */
export function seedDatasets(): Record<string, ScreenData> {
  const fixture = createMockData();
  const primary = getPreviewData('super_admin');
  primary.queue = [];
  primary.initialCart = [];
  primary.user = null;
  primary.teamLinks = fixture.prototype.team_squad_links;
  primary.eventTypes = Object.entries(fixture.prototype.sport_config.scoring_events)
    .map(([value, config]) => ({ value, label: value.replace(/^./, c => c.toUpperCase()), points: config.points }));
  primary.products = primary.products.map(product => ({ ...product, club_id: primary.clubs[0].club_id }));
  primary.orders = fixture.prototype.orders.map(order => ({ ...order, club_id: primary.clubs[0].club_id }));
  // A second populated tenant makes isolation and context changes demonstrable.
  const beta = JSON.parse(JSON.stringify(primary).replace(/alpha/g, 'beta').replace(/Alpha/g, 'Beta').replace(/demo-/g, 'beta-demo-')) as ScreenData;
  beta.tenant = fixture.prototype.tenant_options[1];
  beta.tenants = fixture.prototype.tenant_options;
  beta.orders = [];
  return { [primary.tenant!.tenant_id]: primary, [beta.tenant!.tenant_id]: beta };
}
