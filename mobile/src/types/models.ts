// Presentation models: data injection is intentionally independent of transport.
export type Role = 'super_admin' | 'league_organizer' | 'club_manager' | 'player' | 'viewer';
export type Connection = 'online' | 'offline' | 'syncing';
export type League = { league_id: string; name: string; sport_id?: string; tenant_id?: string; season?: string; format?: string };
export type Player = { player_id: string; name: string; position: string; squad_id?: string; role?: string; on_loan?: boolean; club_id?: string };
export type Variant = { variant_id: string; size?: string | null; color?: string | null; price_minor: number; stock: number };
export type Product = { product_id: string; name: string; category: string; description?: string; image_url?: string | null; club_id?: string; variants: Variant[] };
export type MatchEvent = { event_id: string; sequence: number; type: string; label?: string; payload: Record<string, unknown>; compensated: boolean; compensated_by?: string | null };
export type Fixture = { match_id: string; league_id: string; home_team_id: string; away_team_id: string; home_name?: string; away_name?: string; status: string; scheduled_at: string | null; venue?: string | null; score: { home: number | null; away: number | null }; version: number; events?: MatchEvent[]; pinned_product?: Product | null; home_extra?: string; away_extra?: string };
export type Standing = { team_id: string; name?: string; rank: number; played: number; won: number; drawn: number; lost: number; points: number; status: string; resolved_by?: string | null };
export type Club = { club_id: string; name: string; tenant_id: string; home_venue?: { name: string; lat?: number; lng?: number } | null; socials?: Record<string, string>; staff: { name: string; role: string }[]; roster: Player[]; stats_by_season?: { season: string; played: number; won: number; drawn: number; lost: number }[] };
export type Order = { order_id: string; customer_id?: string; club_id?: string; status: string; created_at?: string; currency: string; subtotal_minor: number; discount_minor: number; total_minor: number; items: { variant_id: string; name?: string; quantity: number; unit_price_minor: number }[]; payment?: { state: string }; paid_at?: string };
export type QueueItem = { action_id: string; label: string; queued_at: string; status: 'pending' | 'applied' | 'rejected' | 'duplicate' | 'deferred'; reason?: string };
export type HistoryEntry = { audit_id: string; action: string; effective_date: string; who: string; why: string; state: string };
export type CartLine = { productId: string; name: string; variant: Variant; quantity: number };
export type ScreenData = {
  tenant: { name: string; tenant_id: string; logo_url?: string | null; colors?: { primary: string; secondary: string } } | null;
  user: { user_id?: string; role?: Role; tenant_id?: string | null; display_name: string; email: string; club_id?: string | null; player_id?: string | null; league_ids?: string[] } | null;
  leagues: League[]; fixtures: Fixture[]; standings: Record<string, Standing[]>;
  clubs: Club[]; players: Player[]; products: Product[]; orders: Order[];
  history: Record<string, HistoryEntry[]>; queue: QueueItem[];
  eventTypes: { value: string; label: string; points?: number }[]; lastUpdated: string | null;
  tenants?: NonNullable<ScreenData['tenant']>[];
  squads?: { squad_id: string; name: string; club_id: string; league_id: string }[];
  sports?: { sport_id: string; name: string; config: { scoring_events: Record<string, { points?: number }>; roster?: { required_positions: Record<string, number> } } }[];
  registrations?: { player_id: string; league_id: string; squad_id: string | null; role: string; on_loan: boolean }[];
};
