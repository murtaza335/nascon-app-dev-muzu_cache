import { createMockData } from '../../tests/fixtures/mockData';
import type { Role, ScreenData, SyncScenario, QueueItem } from '../types/preview';
import { errorMessage } from '../services/api/errorMessages';

/** Empty injection fallback. Real HTTP services are intentionally not connected. */
export const emptyPreviewData: ScreenData = {
  tenant: null, user: null, leagues: [], fixtures: [], standings: {}, clubs: [],
  players: [], products: [], orders: [], history: {}, queue: [], eventTypes: [], lastUpdated: null,
};

/** Read-only adapter for the separately owned, synthetic fixture module.
 * Provisional prototype relationships are never treated as API contracts.
 */
export function getPreviewData(role: Role, tenantId?: string, scenario: SyncScenario = 'pending'): ScreenData {
  const mock = createMockData();
  const account = mock.api.me_by_role[role];
  const tenant = role === 'super_admin' ? mock.prototype.tenant_options.find(x => x.tenant_id === tenantId) || mock.prototype.tenant_options[0] : account.tenant;
  const leagues = mock.api.leagues.data.filter(x => x.tenant_id === tenant?.tenant_id);
  const leagueIds = new Set(leagues.map(x => x.league_id));
  const label = (id: string) => (mock.prototype.team_labels as Record<string,string>)[id] || id;
  const title = (text: string) => text.replace(/_/g,' ').replace(/^./, x => x.toUpperCase());
  const fixtures = Object.values(mock.api.matches_by_id).filter(x => leagueIds.has(x.league_id)).map(x => ({
    match_id:x.match_id,league_id:x.league_id,home_team_id:x.home.team_id,away_team_id:x.away.team_id,
    home_name:label(x.home.team_id),away_name:label(x.away.team_id),status:x.status,
    scheduled_at:x.scheduled_at,venue:x.venue,score:{home:x.home.score,away:x.away.score},
    version:x.version,pinned_product:x.pinned_product,
    events:x.events.map(event => ({...event,label:event.type==='score'&&typeof event.payload.event_type==='string'?`${title(event.payload.event_type)} · ${label(String(event.payload.team_id))}`:title(event.type)})),
  }));
  const clubs = Object.values(mock.api.clubs_by_id).filter(x => x.tenant_id === tenant?.tenant_id).map(x => ({...x,roster:x.roster.map(player=>({...player,club_id:x.club_id}))}));
  const history = Object.fromEntries(Object.entries(mock.api.player_history_by_id).filter(([id])=>clubs.some(x=>x.roster.some(y=>y.player_id===id))).map(([id,value])=>[id,value.history]));
  const inPrimaryTenant = tenant?.tenant_id === mock.prototype.tenant_options[0].tenant_id;
  const orders = inPrimaryTenant && ['viewer','club_manager','super_admin'].includes(role) ? mock.prototype.orders : [];
  const products = inPrimaryTenant ? mock.api.products.data : [];
  const session = role==='league_organizer'?mock.prototype.offline_sessions.organizer:role==='club_manager'?mock.prototype.offline_sessions.manager:null;
  let queue: QueueItem[] = session && session.scope.tenant_id===tenant?.tenant_id ? session.request.actions.map(action=>({action_id:action.action_id,label:action.type==='score_event'?`Record ${title(action.payload.type)}`:`${title(action.payload.type)} player`,queued_at:action.queued_at,status:'pending'})) : [];
  if (scenario!=='pending' && session && queue.length) {
    const outcome = role==='league_organizer' ? mock.outcomes.organizer_sync : scenario==='applied'?mock.outcomes.manager_sync_applied:scenario==='rejected'?mock.outcomes.manager_sync_rejected:mock.outcomes.manager_sync_duplicate;
    queue = queue.map(item=>{const result=outcome.results.find(x=>x.action_id===item.action_id);return result?{...item,status:result.status as QueueItem['status'],reason:result.error_code?errorMessage(result.error_code):result.resolution==='rebased_append'?'Applied after refreshing the match version.':undefined}:item;});
  }
  const initialCart = mock.prototype.cart.items.flatMap(line=>products.flatMap(product=>product.variants.filter(v=>v.variant_id===line.variant_id).map(variant=>({productId:product.product_id,name:product.name,variant,quantity:line.quantity}))));
  return {tenant,user:account.user,leagues,fixtures,clubs,players:clubs.flatMap(x=>x.roster),products,orders,history,queue,
    standings:Object.fromEntries(Object.values(mock.api.standings_by_league).filter(x=>leagueIds.has(x.league_id)).map(x=>[x.league_id,x.table.map(row=>({...row,name:label(row.team_id)}))])),
    eventTypes:inPrimaryTenant?Object.keys(mock.prototype.sport_config.scoring_events).map(value=>({value,label:title(value)})):[],
    lastUpdated:mock.meta.snapshot_at,tenants:mock.prototype.tenant_options,squads:mock.prototype.squads.filter(x=>x.tenant_id===tenant?.tenant_id),initialCart,
  };
}
