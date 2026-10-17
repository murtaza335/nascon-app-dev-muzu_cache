import type { Club, Fixture, League, Order, Player, Product, ScreenData, Standing } from '../../types/models';
import type { Client } from './client';
const id = encodeURIComponent;
type MatchResponse = { match_id: string; league_id: string; status: string; version: number; home: { team_id: string; score: number; overs?: string; wickets?: number }; away: { team_id: string; score: number; overs?: string; wickets?: number }; events: Fixture['events']; pinned_product: Product | null; venue: string | { venue_id: string } | null; scheduled_at: string | null };
export function fixtureView(row: Fixture, leagueId: string): Fixture { return { ...row, league_id: leagueId, venue: venueName(row.venue) }; }
function venueName(venue: unknown): string | null { return typeof venue === 'string' ? venue : venue && typeof venue === 'object' && 'venue_id' in venue ? String(venue.venue_id) : null; }
export function matchView(value: MatchResponse, previous?: Fixture): Fixture {
  return { ...previous, match_id: value.match_id, league_id: value.league_id, home_team_id: value.home.team_id, away_team_id: value.away.team_id, status: value.status, version: value.version,
    score: { home: value.home.score, away: value.away.score }, events: value.events, pinned_product: value.pinned_product ? { ...value.pinned_product, variants: value.pinned_product.variants || [] } : null,
    venue: venueName(value.venue), scheduled_at: value.scheduled_at, home_extra: value.home.overs ? `${value.home.wickets} wickets · ${value.home.overs} overs` : undefined, away_extra: value.away.overs ? `${value.away.wickets} wickets · ${value.away.overs} overs` : undefined };
}
export function orderView(value: Order & { receipt?: { payload?: { paid_at?: string } } }): Order { return { ...value, paid_at: value.receipt?.payload?.paid_at }; }
export async function loadData(client: Client, tenantId: string | null): Promise<ScreenData> {
  const me = await client.request<Pick<ScreenData, 'user' | 'tenant'>>('/me');
  const context = await client.request<{ tenants: NonNullable<ScreenData['tenants']>; clubs: Pick<Club, 'club_id' | 'tenant_id' | 'name'>[]; squads: ScreenData['squads']; sports: ScreenData['sports']; players: Player[]; registrations: ScreenData['registrations'] }>(`/context${tenantId && me.user?.role !== 'super_admin' ? `?tenant_id=${id(tenantId)}` : ''}`);
  if (tenantId) { context.clubs = context.clubs.filter(x => x.tenant_id === tenantId); context.squads = context.squads?.filter(x => context.clubs.some(c => c.club_id === x.club_id)); context.players = context.players.filter(x => context.clubs.some(c => c.club_id === x.club_id)); }
  const leagues = (await client.list<League>('/leagues')).filter(x => !tenantId || x.tenant_id === tenantId);
  const fixtures: Fixture[] = []; const standings: Record<string, Standing[]> = {};
  // Sequential bounded pages avoid exceeding the server's 100 requests / 10s limit.
  for (const league of leagues) {
    fixtures.push(...(await client.list<Fixture>(`/leagues/${id(league.league_id)}/fixtures`)).map(x => fixtureView(x, league.league_id)));
    standings[league.league_id] = (await client.request<{ table: Standing[] }>(`/leagues/${id(league.league_id)}/standings`)).table;
  }
  const clubs: Club[] = [];
  for (const club of context.clubs) { const full = await client.request<Club>(`/clubs/${id(club.club_id)}`); full.roster = full.roster.map(player => ({ ...player, club_id: full.club_id })); clubs.push(full); }
  const products = (await client.list<Product>('/store/products')).filter(x => !tenantId || clubs.some(c => c.club_id === x.club_id));
  const orders = (await client.list<Order>('/store/orders')).map(orderView).filter(order => me.user?.role !== 'super_admin' || !tenantId || order.items.some(item => products.some(product => product.variants.some(variant => variant.variant_id === item.variant_id))));
  const registered = clubs.flatMap(c => c.roster);
  const players = [...registered, ...context.players.filter(player => !registered.some(row => row.player_id === player.player_id))];
  const teamName = (teamId: string) => context.squads?.find(s => s.squad_id === teamId)?.name || context.clubs.find(c => c.club_id === teamId)?.name;
  for (const fixture of fixtures) { fixture.home_name = teamName(fixture.home_team_id); fixture.away_name = teamName(fixture.away_team_id); }
  for (const rows of Object.values(standings)) for (const row of rows) row.name = teamName(row.team_id);
  return { ...me, tenant: context.tenants.find(t => t.tenant_id === tenantId) || me.tenant, tenants: context.tenants, leagues, fixtures, standings, clubs, players, products, orders, registrations: context.registrations?.filter(x => leagues.some(l => l.league_id === x.league_id)), squads: context.squads, sports: context.sports,
    history: {}, queue: [], eventTypes: [], lastUpdated: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z') };
}
export async function loadMatch(client: Client, matchId: string, previous?: Fixture) { return matchView(await client.request<MatchResponse>(`/matches/${id(matchId)}`), previous); }
