import type { MockWorld } from '../mock/engine';
export type Preferences={serverUrl:string;theme:'dark'|'light'|'system';simulateOffline:boolean};
type Rows={length:number;item:(index:number)=>{payload?:string}};
type Database={executeSql:(query:string,params?:unknown[])=>Promise<{rows:Rows}[]>};
// ADR-017 fallback. Narrow declarations describe only the methods used here.
const SQLite=require('react-native-sqlite-storage') as {enablePromise:(enabled:boolean)=>void;openDatabase:(options:{name:string;location:string})=>Promise<Database>};
SQLite.enablePromise(true);
let database:Promise<Database>|undefined;
async function db(){
  if(!database)database=SQLite.openDatabase({name:'nascon-mock-v1.sqlite',location:'default'}).then(async value=>{await value.executeSql('CREATE TABLE IF NOT EXISTS mock_state (scope TEXT PRIMARY KEY NOT NULL, payload TEXT NOT NULL)');return value;}).catch(error=>{database=undefined;throw error;});
  return database;
}
async function read<T>(scope:string):Promise<T|null>{const value=await db();const [result]=await value.executeSql('SELECT payload FROM mock_state WHERE scope = ?',[scope]);const row=result.rows.length?result.rows.item(0):null;return row?.payload?JSON.parse(row.payload) as T:null;}
async function write(scope:string,value:unknown){const valueDb=await db();await valueDb.executeSql('INSERT OR REPLACE INTO mock_state (scope, payload) VALUES (?, ?)',[scope,JSON.stringify(value)]);}
// Snapshot and queue commit together before success feedback, including after reload.
export const mockStorage={readWorld:(server:string)=>read<MockWorld>(`world:${server}`),saveWorld:(server:string,world:MockWorld)=>write(`world:${server}`,world),readPreferences:()=>read<Preferences>('preferences'),savePreferences:(value:Preferences)=>write('preferences',value)};
