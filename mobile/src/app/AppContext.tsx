import { createContext, ReactNode, useContext, useEffect, useRef, useState } from 'react';
import { AppState, NativeModules, useColorScheme } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { API_BASE_URL } from '../config/env';
import type { CartLine, Connection, HistoryEntry, Role } from '../types/models';
import { ApiError, createClient, normalizeServer } from '../services/api/client';
import { loadData, loadMatch, orderView } from '../services/api/models';
import { ActionResult, Command, queuePayload } from '../services/api/commands';
import { errorMessage } from '../services/api/errorMessages';
import { Session, sessionScope, sessionStorage, validSession } from '../services/auth/session';
import { emptyWorkspace, newId, PendingAction, Preferences, storage, Workspace } from '../services/storage/storage';
import { setPalette } from '../theme/tokens';

export const roleNames: Record<Role, string> = { viewer: 'Viewer', player: 'Player', club_manager: 'Club Manager', league_organizer: 'League Organizer', super_admin: 'Super Admin' };
const defaults: Preferences = { serverUrl: API_BASE_URL, theme: 'system' };
const utc = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
function useAppValue() {
  const commits = useRef(Promise.resolve()); const dataEpoch = useRef(0);
  const [workspace, setWorkspace] = useState(emptyWorkspace); const work = useRef(workspace);
  const [session, setSession] = useState<Session | null>(null); const auth = useRef(session);
  const [preferences, setPreferences] = useState(defaults); const prefs = useRef(preferences);
  const [ready, setReady] = useState(false); const [bootError, setBootError] = useState('');
  const [busy, setBusy] = useState(false); const locked = useRef(false); const [blocking, setBlocking] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false); const fetching = useRef<Session | null>(null);
  const [resourceError, setResourceError] = useState(''); const [message, setMessage] = useState<string | null>(null);
  const [networkOnline, setNetworkOnline] = useState(true); const online = useRef(true);
  const [syncing, setSyncing] = useState(false); const [leagueId, setLeagueId] = useState<string>();
  const [cartUndo, setCartUndo] = useState<CartLine[] | null>(null); const watched = useRef(new Map<string, number>()); const socket = useRef<WebSocket | null>(null);
  const systemTheme = useColorScheme(); const theme = preferences.theme === 'system' ? systemTheme === 'dark' ? 'dark' : 'light' : preferences.theme;
  setPalette(theme);
  const notify = (text: string) => setMessage(text);
  const publish = (value: Workspace) => { work.current = value; setWorkspace(value); };
  const publishSession = (value: Session | null) => { auth.current = value; setSession(value); };
  const isCurrent = (s: Session) => auth.current === s;
  async function save(value: Workspace | ((previous: Workspace) => Workspace), s = auth.current) {
    if (!s) return;
    const task = commits.current.catch(() => {}).then(async () => { if (!isCurrent(s)) return; const next = typeof value === 'function' ? value(work.current) : value; await storage.saveWorkspace(sessionScope(s), next); if (isCurrent(s)) publish(next); });
    commits.current = task; await task;
  }
  async function expire(s = auth.current) { if (!s || !isCurrent(s)) return; publishSession(null); await sessionStorage.clear(); publish(emptyWorkspace()); setCartUndo(null); setResourceError(''); notify('Your session expired, please sign in again. Pending work is retained.'); }
  const clientFor = (s: Session) => createClient(s.serverUrl, s.token, () => expire(s));
  const showError = (error: unknown) => error instanceof Error ? error.message : 'Something went wrong. Please try again.';
  // Stale server URLs from previous builds (emulator loopback, old defaults) are replaced
  // with the current default on boot so users connect to the live server without visiting Settings.
  const LEGACY_URLS = ['http://10.0.2.2:8080', 'http://localhost:8080', 'http://127.0.0.1:8080'];
  async function load() {
    setReady(false); setBootError('');
    try {
      let next = await storage.readPreferences() || defaults;
      // Auto-migrate old emulator/localhost defaults to the current live server.
      if (LEGACY_URLS.includes(next.serverUrl.replace(/\/+$/, '')) && API_BASE_URL !== next.serverUrl) {
        next = { ...next, serverUrl: API_BASE_URL };
        await storage.savePreferences(next);
        await sessionStorage.clear(); // force re-login against the new server
      }
      prefs.current = next; setPreferences(next);
      const restored = await sessionStorage.read();
      if (validSession(restored, next.serverUrl)) { publishSession(restored); publish(await storage.readWorkspace(sessionScope(restored!)) || emptyWorkspace()); }
      else { await sessionStorage.clear(); publishSession(null); if (restored) notify('Server address updated. Please sign in to continue.'); }
      setReady(true);
    } catch { setBootError('Could not open secure local storage. Retry, or rebuild the Android app with its native modules.'); }
  }
  useEffect(() => { void load(); return NetInfo.addEventListener(state => { online.current = state.isConnected !== false; setNetworkOnline(online.current); }); }, []);
  /** `label` marks user-started work that blocks input behind the loading overlay; background work passes none. */
  async function withLock<T>(job: () => Promise<T>, fallback: T, label?: string): Promise<T> {
    if (locked.current) return fallback;
    locked.current = true; setBusy(true); if (label) setBlocking(label);
    try { return await job(); } catch (error) { notify(showError(error)); return fallback; } finally { locked.current = false; setBusy(false); setBlocking(null); }
  }
  async function refresh() {
    const s = auth.current; if (!s || !online.current || fetching.current === s || locked.current) return;
    const epoch = dataEpoch.current; fetching.current = s; setRefreshing(true); setResourceError('');
    try {
      const data = await loadData(clientFor(s), s.tenantId);
      for (const matchId of watched.current.keys()) { const index = data.fixtures.findIndex(x => x.match_id === matchId); if (index >= 0) data.fixtures[index] = await loadMatch(clientFor(s), matchId, data.fixtures[index]); }
      if (isCurrent(s) && epoch === dataEpoch.current) await save(previous => ({ ...previous, data: { ...data, history: previous.data.history, fixtures: data.fixtures.map(match => { const old = previous.data.fixtures.find(x => x.match_id === match.match_id); return old?.version === match.version && !match.events ? { ...old, ...match, events: old.events } : match; }) } }), s);
    } catch (error) { if (isCurrent(s)) setResourceError(showError(error)); }
    finally { if (fetching.current === s) { fetching.current = null; setRefreshing(false); if (isCurrent(s) && epoch !== dataEpoch.current) void refresh(); } }
  }
  async function login(email: string, password: string) {
    return withLock(async () => {
      if (!online.current) throw new Error('Connect to your server before signing in.');
      const response = await createClient(prefs.current.serverUrl).request<Omit<Session, 'serverUrl' | 'tenantId' | 'userId'>>('/auth/login', 'POST', { email: email.trim(), password });
      const next: Session = { ...response, serverUrl: prefs.current.serverUrl, tenantId: response.user.tenant_id || null, userId: response.user.user_id! };
      const saved = await storage.readWorkspace(sessionScope(next)) || emptyWorkspace();
      await sessionStorage.save(next); publishSession(next); publish({ ...saved, data: { ...saved.data, user: response.user, tenant: response.tenant } });
      setLeagueId(undefined); setMessage(null); setResourceError(''); return true;
    }, false, 'Signing you in…');
  }
  async function logout(discardPending = false) {
    return withLock(async () => {
      const s = auth.current; publishSession(null); await commits.current.catch(() => {});
      if (s) await storage.saveWorkspace(sessionScope(s), { ...emptyWorkspace(), pending: discardPending ? [] : work.current.pending });
      await sessionStorage.clear(); publishSession(null); publish(emptyWorkspace()); watched.current.clear(); setCartUndo(null); setLeagueId(undefined); setResourceError(''); setMessage(null); return true;
    }, false, 'Signing out…');
  }
  async function changeServer(value: string) {
    return withLock(async () => {
      const serverUrl = normalizeServer(value); const s = auth.current; publishSession(null); await commits.current.catch(() => {});
      if (s) await storage.saveWorkspace(sessionScope(s), { ...emptyWorkspace(), pending: work.current.pending });
      await sessionStorage.clear(); const next = { ...prefs.current, serverUrl }; await storage.savePreferences(next);
      prefs.current = next; setPreferences(next); publishSession(null); publish(emptyWorkspace()); watched.current.clear(); setCartUndo(null); setResourceError(''); setLeagueId(undefined); notify('Server address saved. Sign in to continue.'); return true;
    }, false, 'Switching server…');
  }
  async function setTenantId(tenantId: string) {
    await withLock(async () => {
      const s = auth.current; if (!s || s.user.role !== 'super_admin') return;
      const next = { ...s, tenantId }; const saved = await storage.readWorkspace(sessionScope(next)) || emptyWorkspace();
      await sessionStorage.save(next); publishSession(next); publish({ ...saved, data: { ...saved.data, user: s.user, tenants: work.current.data.tenants, tenant: work.current.data.tenants?.find(x => x.tenant_id === tenantId) || null } });
      watched.current.clear(); setLeagueId(undefined); setCartUndo(null); setResourceError('');
    }, undefined, 'Switching organization…');
  }
  async function syncInternal(s: Session) {
    if (!online.current || !work.current.pending.length) return;
    setSyncing(true);
    try {
      const batch = work.current.pending.slice(0, 100);
      const response = await clientFor(s).request<{ results: { action_id: string; status: 'applied' | 'rejected' | 'duplicate'; error_code?: string | null }[] }>('/offline-sync', 'POST', { device_id: await storage.deviceId(), actions: batch });
      if (!isCurrent(s)) return;
      const resolved = new Set(response.results.map(x => x.action_id));
      const outcomes = response.results.map(result => { const action = batch.find(x => x.action_id === result.action_id)!; return { action_id: result.action_id, label: action.type === 'score_event' ? 'Match event' : 'Registration change', queued_at: action.queued_at, status: result.status, reason: result.error_code ? errorMessage(result.error_code) : undefined }; });
      await save({ ...work.current, pending: work.current.pending.filter(x => !resolved.has(x.action_id)), outcomes: [...outcomes, ...work.current.outcomes].slice(0, 100) }, s);
    } finally { setSyncing(false); }
  }
  async function sync() { const s = auth.current; if (!s || !online.current || !work.current.pending.length) return; await withLock(() => syncInternal(s), undefined); await refresh(); }
  useEffect(() => { if (ready && session) { void refresh(); void sync(); } }, [ready, session, networkOnline]);
  useEffect(() => {
    const update = () => { const s = auth.current; if (!s) return; if (!validSession(s, s.serverUrl)) { void expire(s); return; } if (online.current) { void sync(); void refresh(); } };
    const timer = setInterval(update, 30000); const sub = AppState.addEventListener('change', state => { if (state === 'active') update(); });
    return () => { clearInterval(timer); sub.remove(); };
  }, []);
  // Refresh authoritative projections on realtime notifications; polling remains the fallback.
  useEffect(() => {
    if (!session || !networkOnline) return;
    const ws = new WebSocket(`${session.serverUrl.replace(/^http/, 'ws')}/api/v1/ws?token=${encodeURIComponent(session.token)}`);
    socket.current = ws;
    ws.onopen = () => { for (const league of work.current.data.leagues) ws.send(JSON.stringify({ type: 'subscribe', topic: `league:${league.league_id}` })); for (const matchId of watched.current.keys()) ws.send(JSON.stringify({ type: 'subscribe', topic: `match:${matchId}` })); };
    let timer: ReturnType<typeof setTimeout> | undefined;
    ws.onmessage = event => { let frame; try { frame = JSON.parse(event.data); } catch { return; } if (!['match.event_appended','match.status_changed','match.pinned_product_changed','standings.changed','inventory.changed'].includes(frame.type)) return; if (!timer) timer = setTimeout(() => { timer = undefined; void refresh(); }, 700); };
    ws.onclose = event => { if (event.code === 4401) void expire(session); };
    return () => { if (timer) clearTimeout(timer); if (socket.current === ws) socket.current = null; ws.close(); };
  }, [session, networkOnline, workspace.data.leagues.map(x => x.league_id).join('|')]);
  async function run(command: Command): Promise<ActionResult> {
    const result = await withLock<ActionResult>(async () => {
      const s = auth.current; if (!s || !validSession(s, s.serverUrl)) { await expire(s); return { ok: false, code: 'UNAUTHENTICATED', message: errorMessage('UNAUTHENTICATED') }; }
      dataEpoch.current += 1; const client = clientFor(s); const requestId = newId();
      if (command.kind === 'score' || command.kind === 'roster') {
        const action: PendingAction = { action_id: requestId, type: command.kind === 'score' ? 'score_event' : 'roster_transfer', queued_at: utc(), base_version: command.kind === 'score' ? work.current.data.fixtures.find(x => x.match_id === command.matchId)?.version || 0 : work.current.data.history[command.playerId]?.length || 0, payload: queuePayload(command, work.current.data, requestId, s.userId) };
        await save({ ...work.current, pending: [...work.current.pending, action] }, s);
        if (online.current) {
          try { await syncInternal(s); } catch (error) { if (error instanceof ApiError && error.status === 401) return { ok: false, code: error.code, message: error.message }; notify('Saved on this device. Sync will retry when your server is reachable.'); }
        }
        const outcome = work.current.outcomes.find(x => x.action_id === requestId);
        if (outcome?.status === 'rejected') { notify(outcome.reason || 'The server rejected this action.'); return { ok: false, code: 'REJECTED', message: outcome.reason || 'Action rejected.' }; }
        const queued = work.current.pending.some(x => x.action_id === requestId); const message = queued ? 'Saved as pending. Open Sync status to follow progress.' : 'Saved. The server accepted your action.'; notify(message); return { ok: true, queued, message };
      }
      if (!online.current) throw new Error('This action needs a connection to your server.');
      let resultId: string | undefined;
      if (command.kind === 'checkout') {
        const fingerprint = JSON.stringify([command.lines.map(x => [x.variant.variant_id, x.quantity]), command.discount, command.payment]);
        const orderId = work.current.checkout?.fingerprint === fingerprint ? work.current.checkout.orderId : requestId;
        await save({ ...work.current, checkout: { fingerprint, orderId } }, s);
        const order = orderView(await client.request<any>('/store/checkout', 'POST', { order_id: orderId, items: command.lines.map(x => ({ variant_id: x.variant.variant_id, quantity: x.quantity })), discount_code: command.discount.trim() || null, payment: { token: command.payment } }));
        await save({ ...work.current, cart: [], checkout: undefined, data: { ...work.current.data, orders: [order, ...work.current.data.orders.filter(x => x.order_id !== order.order_id)] } }, s); setCartUndo(null); resultId = order.order_id;
      } else if (command.kind === 'pin') await client.request(`/matches/${encodeURIComponent(command.matchId)}/pin`, 'PUT', { product_id: command.productId || null });
      else if (command.kind === 'editPlayer') await client.request(`/players/${encodeURIComponent(command.playerId)}`, 'PATCH', { name: command.name, position: command.position });
      else if (command.kind === 'orderTransition') await client.request(`/store/orders/${encodeURIComponent(command.orderId)}/transition`, 'POST', { to: command.to });
      else if (command.kind === 'addPlayer') { const result = await client.request<{ player: { player_id: string } }>(`/clubs/${encodeURIComponent(command.clubId)}/players`, 'POST', { name: command.name, position: command.position, league_id: command.leagueId, squad_id: command.squadId, role: command.role }); resultId = result.player.player_id; }
      notify('Saved successfully.'); return { ok: true, id: resultId, message: 'Saved successfully.' };
    }, { ok: false, code: 'SERVICE_UNAVAILABLE', message: 'Could not complete this action. Please retry.' }, command.kind === 'checkout' ? 'Placing your order…' : 'Saving your changes…');
    if (result.ok && !result.queued) void refresh(); return result;
  }
  async function setCart(value: CartLine[] | ((previous: CartLine[]) => CartLine[])) {
    return withLock(async () => { const previous = work.current.cart; const cart = typeof value === 'function' ? value(previous) : value; if (cart.length > 10 || cart.some(x => !Number.isInteger(x.quantity) || x.quantity < 1 || x.quantity > 10)) throw new Error('Choose up to 10 items, with quantities between 1 and 10.'); await save({ ...work.current, cart }); setCartUndo(previous); return true; }, false);
  }
  async function addToCart(line: CartLine) {
    const previous = work.current.cart; const existing = previous.find(x => x.variant.variant_id === line.variant.variant_id); const quantity = (existing?.quantity || 0) + line.quantity;
    if (quantity > line.variant.stock || quantity > 10) { notify('This quantity is not available. Choose fewer items.'); return; }
    if (await setCart(existing ? previous.map(x => x === existing ? { ...x, quantity } : x) : [...previous, line])) notify('Added to your cart.');
  }
  async function undoCart() { if (cartUndo) { const previous = cartUndo; if (await setCart(previous)) { setCartUndo(null); notify('Cart change undone.'); } } }
  async function setTheme(value: Preferences['theme']) { try { const next = { ...prefs.current, theme: value }; await storage.savePreferences(next); prefs.current = next; setPreferences(next); } catch { notify('Could not save the appearance setting.'); } }
  async function fetchMatch(matchId: string) {
    const s = auth.current; if (!s || !online.current) return;
    try { const match = await loadMatch(clientFor(s), matchId, work.current.data.fixtures.find(x => x.match_id === matchId)); if (isCurrent(s)) await save(previous => ({ ...previous, data: { ...previous.data, fixtures: [...previous.data.fixtures.filter(x => x.match_id !== matchId), match] } }), s); }
    catch (error) { if (isCurrent(s)) setResourceError(showError(error)); }
  }
  function watchMatch(matchId: string) {
    watched.current.set(matchId, (watched.current.get(matchId) || 0) + 1);
    if (socket.current?.readyState === 1) socket.current.send(JSON.stringify({ type: 'subscribe', topic: `match:${matchId}` }));
    void fetchMatch(matchId);
    return () => { const count = (watched.current.get(matchId) || 1) - 1; if (count) watched.current.set(matchId, count); else { watched.current.delete(matchId); if (socket.current?.readyState === 1) socket.current.send(JSON.stringify({ type: 'unsubscribe', topic: `match:${matchId}` })); } };
  }
  async function fetchHistory(playerId: string) {
    const s = auth.current; if (!s || !online.current) return;
    try { const result = await clientFor(s).request<{ history: HistoryEntry[] }>(`/players/${encodeURIComponent(playerId)}/history`); if (isCurrent(s)) await save(previous => ({ ...previous, data: { ...previous.data, history: { ...previous.data.history, [playerId]: result.history } } }), s); }
    catch (error) { if (isCurrent(s)) setResourceError(showError(error)); }
  }
  async function exportReceipt(orderId: string, download: boolean) {
    const s = auth.current; if (!s) throw new Error('Sign in to view your receipt.');
    if (!NativeModules.NaSConReceipt) throw new Error('Rebuild the Android app to enable PDF export.');
    const blob = await clientFor(s).request<Blob>(`/store/orders/${encodeURIComponent(orderId)}/receipt.pdf`, 'GET', undefined, true);
    const base64 = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.onerror = reject; reader.readAsDataURL(blob); });
    return NativeModules.NaSConReceipt.exportReceipt(base64, `receipt-${orderId.replace(/[^a-z0-9_-]/gi, '_')}.pdf`, download) as Promise<string>;
  }
  const selectedLeague = workspace.data.leagues.find(x => x.league_id === leagueId) || workspace.data.leagues[0];
  const eventsFor = (matchId?: string) => { const league = matchId ? workspace.data.leagues.find(l => l.league_id === workspace.data.fixtures.find(m => m.match_id === matchId)?.league_id) : selectedLeague; return Object.entries(workspace.data.sports?.find(x => x.sport_id === league?.sport_id)?.config.scoring_events || {}).map(([value, config]) => ({ value, label: value.replace(/_/g, ' '), points: config.points })); };
  const data = { ...workspace.data, eventTypes: eventsFor(), queue: [...workspace.pending.map(x => ({ action_id: x.action_id, queued_at: x.queued_at, label: x.type === 'score_event' ? 'Match event' : 'Registration change', status: 'pending' as const, reason: undefined })), ...workspace.outcomes] };
  const connection: Connection = syncing ? 'syncing' : networkOnline ? 'online' : 'offline';
  return { data, role: session?.user.role || 'viewer' as Role, connection, selectedLeague, setLeagueId, serverUrl: preferences.serverUrl, setServerUrl: changeServer,
    cart: workspace.cart, setCart, message, setMessage, notify, addToCart, setTenantId, session, ready, bootError, retryBoot: load, busy, blocking, refreshing, resourceError, refresh, run, login, logout, sync,
    theme, themePreference: preferences.theme, setTheme, pendingCount: workspace.pending.length, undoCart, canUndoCart: !!cartUndo, watchMatch, fetchHistory, eventsFor, exportReceipt };
}
type AppValue = ReturnType<typeof useAppValue>;
const Context = createContext<AppValue | null>(null);
export function AppProvider({ children }: { children: ReactNode }) { const value = useAppValue(); return <Context.Provider value={value}>{children}</Context.Provider>; }
export function useApp() { const value = useContext(Context); if (!value) throw new Error('AppProvider is missing'); return value; }
