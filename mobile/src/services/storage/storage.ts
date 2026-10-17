import type { CartLine, QueueItem, ScreenData } from '../../types/models';
export type Preferences = { serverUrl: string; theme: 'dark' | 'light' | 'system' };
export type PendingAction = { action_id: string; type: 'score_event' | 'roster_transfer'; queued_at: string; base_version: number; payload: Record<string, unknown> };
export type Workspace = { data: ScreenData; cart: CartLine[]; pending: PendingAction[]; outcomes: QueueItem[]; checkout?: { fingerprint: string; orderId: string } };
type Database = { executeSql: (query: string, params?: unknown[]) => Promise<{ rows: { length: number; item: (index: number) => { payload: string } } }[]> };
const SQLite = require('react-native-sqlite-storage') as { enablePromise: (enabled: boolean) => void; openDatabase: (options: { name: string; location: string }) => Promise<Database> };
SQLite.enablePromise(true);
let database: Promise<Database> | undefined;
async function db() {
  if (!database) database = SQLite.openDatabase({ name: 'nascon-api-v1.sqlite', location: 'default' }).then(async value => {
    await value.executeSql('CREATE TABLE IF NOT EXISTS app_state (scope TEXT PRIMARY KEY NOT NULL, payload TEXT NOT NULL)'); return value;
  }).catch(error => { database = undefined; throw error; });
  return database;
}
async function read<T>(scope: string): Promise<T | null> { const [result] = await (await db()).executeSql('SELECT payload FROM app_state WHERE scope = ?', [scope]); return result.rows.length ? JSON.parse(result.rows.item(0).payload) : null; }
async function write(scope: string, value: unknown) { await (await db()).executeSql('INSERT OR REPLACE INTO app_state (scope, payload) VALUES (?, ?)', [scope, JSON.stringify(value)]); }
export const storage = { readWorkspace: (scope: string) => read<Workspace>(`workspace:${scope}`), saveWorkspace: (scope: string, value: Workspace) => write(`workspace:${scope}`, value), readPreferences: () => read<Preferences>('preferences'), savePreferences: (value: Preferences) => write('preferences', value),
  deviceId: async () => { let id = await read<string>('device'); if (!id) { id = newId(); await write('device', id); } return id; },
};
let serial = 0;
export function newId() { return `app-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}-${(++serial).toString(36)}`; }
export function emptyData(): ScreenData { return { tenant: null, user: null, leagues: [], fixtures: [], standings: {}, clubs: [], players: [], products: [], orders: [], history: {}, queue: [], eventTypes: [], lastUpdated: null, squads: [], tenants: [], sports: [] }; }
export function emptyWorkspace(): Workspace { return { data: emptyData(), cart: [], pending: [], outcomes: [] }; }
