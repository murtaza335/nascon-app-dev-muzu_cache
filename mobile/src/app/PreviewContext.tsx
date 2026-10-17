import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, useColorScheme } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { API_BASE_URL } from '../config/env';
import type { CartLine, Connection, Presentation, Role, ScreenData, SyncScenario } from '../types/preview';
import { actorFor, clone, Command, createWorld, dataFor, execute, MockWorld, refreshWorld, Result, scopeKey, syncWorld } from '../services/mock/engine';
import { authenticateMock, isValidSession, MockSession, mockSessionStorage } from '../services/auth/mockSession';
import { mockStorage, Preferences } from '../services/storage/mockStorage';
import { demoAccounts, demoPassword } from '../services/mock/seed';
import { setPalette } from '../theme/tokens';

export const roleNames: Record<Role,string> = { viewer:'Viewer',player:'Player',club_manager:'Club Manager',league_organizer:'League Organizer',super_admin:'Super Admin' };
const defaults: Preferences = { serverUrl:API_BASE_URL,theme:'dark',simulateOffline:false };
const utc = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
let counter=0;
const nextId=() => `local-${Date.now().toString(36)}-${(++counter).toString(36)}`;
const pause=() => new Promise<void>(resolve=>setTimeout(resolve,220));
function usePreviewValue(override?: ScreenData) {
  const [world,setWorld]=useState(createWorld);const worldRef=useRef(world);
  const [session,setSession]=useState<MockSession|null>(null);const sessionRef=useRef(session);
  const [preferences,setPreferences]=useState<Preferences>(defaults);const prefRef=useRef(defaults);
  const [ready,setReady]=useState(false);const [bootError,setBootError]=useState('');
  const [busy,setBusy]=useState(false);const locked=useRef(false);
  const [refreshing,setRefreshing]=useState(false);const [resourceError,setResourceError]=useState('');const [failNext,setFailNext]=useState(false);
  const [networkOnline,setNetworkOnline]=useState(true);const [syncing,setSyncing]=useState(false);
  const [presentation,setPresentation]=useState<Presentation>('content');
  const [syncScenario,setSyncScenario]=useState<SyncScenario>('pending');
  const [leagueId,setLeagueId]=useState<string>();const [message,setMessage]=useState<string|null>(null);
  const [cartUndo,setCartUndo]=useState<CartLine[]|null>(null);
  const systemTheme=useColorScheme();const theme=preferences.theme==='system'?(systemTheme==='light'?'light':'dark'):preferences.theme;
  setPalette(theme);
  const role=session?.role || 'viewer';
  const actor=useMemo(()=>actorFor(role,session?.tenantId),[role,session?.tenantId]);
  const data=useMemo(()=>override||dataFor(world,actor),[world,actor,override]);
  const selectedLeague=data.leagues.find(x=>x.league_id===leagueId)||data.leagues[0];
  const cart=world.carts[scopeKey(actor)] || [];
  const connection:Connection=syncing?'syncing':!networkOnline||preferences.simulateOffline?'offline':'online';
  const onlineRef=useRef(connection!=='offline');onlineRef.current=connection!=='offline';
  const notify=useCallback((value:string)=>setMessage(value),[]);
  const publish=(value:MockWorld)=>{worldRef.current=value;setWorld(value);};
  const publishSession=(value:MockSession|null)=>{sessionRef.current=value;setSession(value);};
  const publishPreferences=(value:Preferences)=>{prefRef.current=value;setPreferences(value);};
  const load=async()=>{
    setBootError('');setReady(false);
    try {
      const prefs=await mockStorage.readPreferences()||defaults;
      const saved=await mockStorage.readWorld(prefs.serverUrl);const next=saved?.version===1?saved:createWorld();
      if(!saved)await mockStorage.saveWorld(prefs.serverUrl,next);
      const restored=await mockSessionStorage.read();
      publishPreferences(prefs);publish(next);
      if(isValidSession(restored,prefs.serverUrl,Date.now()))publishSession(restored);
      else {await mockSessionStorage.clear();publishSession(null);if(restored)notify('Your session expired. Sign in again; pending work is still saved.');}
      setReady(true);
    } catch {setBootError('We could not open secure local storage. Retry after rebuilding the Android app with its native modules. Your saved data has not been reset.');}
  };
  useEffect(()=>{void load();return NetInfo.addEventListener(state=>setNetworkOnline(state.isConnected!==false&&state.isInternetReachable!==false));},[]);
  const expire=async()=>{await mockSessionStorage.clear();publishSession(null);setLeagueId(undefined);setPresentation('content');notify('Your session expired. Sign in again to continue. Pending work is retained.');};
  useEffect(()=>{
    const check=()=>{const current=sessionRef.current;if(current&&!isValidSession(current,prefRef.current.serverUrl,Date.now()))void expire().catch(()=>notify('Could not clear the expired session. Please retry.'));};
    const timer=setInterval(check,15000);const subscription=AppState.addEventListener('change',state=>{if(state==='active'){check();if(onlineRef.current)void refresh();}});
    return()=>{clearInterval(timer);subscription.remove();};
  },[]);
  async function withLock<T>(job:()=>Promise<T>,fallback:T):Promise<T>{
    if(locked.current){notify('Please wait for the current action to finish.');return fallback;}
    locked.current=true;setBusy(true);
    try{return await job();}catch{notify('We could not save this change. Please retry. Your previous information is intact.');return fallback;}
    finally{locked.current=false;setBusy(false);}
  }
  async function login(email:string,password:string){
    return withLock(async()=>{
      if(!onlineRef.current){notify('Connect before signing in. An existing saved session can still reopen offline.');return false;}
      await pause();const next=authenticateMock(email,password,prefRef.current.serverUrl,Date.now());
      if(!next){notify('Email or password is incorrect. Check your details and try again.');return false;}
      await mockSessionStorage.save(next);publishSession(next);setLeagueId(undefined);setPresentation('content');setResourceError('');setMessage(null);return true;
    },false);
  }
  async function changePreferences(next:Preferences){await mockStorage.savePreferences(next);publishPreferences(next);}
  async function changeServer(url:string){
    return withLock(async()=>{const address=url.trim().replace(/\/+$/,'');const parsed=new URL(address);if(!['http:','https:'].includes(parsed.protocol)||parsed.username||parsed.password||parsed.search||parsed.hash)throw new Error();
      const next=await mockStorage.readWorld(address)||createWorld();await mockStorage.saveWorld(address,next);await mockSessionStorage.clear();publishSession(null);
      await changePreferences({...prefRef.current,serverUrl:address});publish(next);setLeagueId(undefined);notify('Server context changed. Sign in to its separate mock workspace. Previous pending work stays with the previous server.');return true;},false);
  }
  async function logout(discardPending=false){
    return withLock(async()=>{const current=sessionRef.current;if(current){const owner=actorFor(current.role,current.tenantId);const next=clone(worldRef.current);delete next.carts[scopeKey(owner)];if(discardPending)next.pending=next.pending.filter(x=>x.actor.userId!==owner.userId||x.actor.tenantId!==owner.tenantId);await mockStorage.saveWorld(prefRef.current.serverUrl,next);publish(next);}
      await mockSessionStorage.clear();publishSession(null);setLeagueId(undefined);setPresentation('content');setMessage(null);return true;},false);
  }
  async function run(command:Command):Promise<Omit<Extract<Result,{ok:true}>,'world'>|Extract<Result,{ok:false}>>{
    return withLock(async()=>{const current=sessionRef.current;if(!isValidSession(current,prefRef.current.serverUrl,Date.now())){await expire();return {ok:false as const,code:'UNAUTHENTICATED',message:'Sign in again to continue.'};}
      await pause();if(failNext){setFailNext(false);notify('The mock service could not complete this request. Please retry.');return {ok:false as const,code:'SERVICE_UNAVAILABLE',message:'Mock service unavailable.'};}
      const principal=actorFor(current!.role,current!.tenantId);const result=execute(worldRef.current,principal,command,nextId(),utc(),onlineRef.current);
      if(result.ok){await mockStorage.saveWorld(prefRef.current.serverUrl,result.world);publish(result.world);setResourceError('');notify(result.message);const {world:_,...response}=result;return response;}
      notify(result.message);return result;
    },{ok:false,code:'SERVICE_UNAVAILABLE',message:'Another operation is in progress.'});
  }
  async function refresh(){
    if(locked.current)return;locked.current=true;setRefreshing(true);setResourceError('');
    try{await pause();if(failNext){setFailNext(false);throw new Error();}if(!onlineRef.current){notify('Offline. Showing the last saved information.');return;}
      const next=refreshWorld(worldRef.current,utc());await mockStorage.saveWorld(prefRef.current.serverUrl,next);publish(next);
    }catch{setResourceError('Could not refresh. Your saved information is still available.');}finally{locked.current=false;setRefreshing(false);}
  }
  async function sync(){
    if(!sessionRef.current||!onlineRef.current||locked.current)return;
    await withLock(async()=>{setSyncing(true);try{await pause();const current=sessionRef.current!;if(!isValidSession(current,prefRef.current.serverUrl,Date.now())){await expire();return false;}
      const principal=actorFor(current.role,current.tenantId);const before=worldRef.current.pending.filter(x=>x.actor.userId===principal.userId&&x.actor.tenantId===principal.tenantId).length;
      const next=syncWorld(worldRef.current,principal,utc());await mockStorage.saveWorld(prefRef.current.serverUrl,next);publish(next);if(before)notify('Sync complete. Review each action’s result below.');return true;
    }finally{setSyncing(false);}},false);
  }
  useEffect(()=>{if(ready&&session&&connection==='online'&&data.queue.some(x=>x.status==='pending'))void sync();},[ready,session?.userId,session?.tenantId,connection]);
  useEffect(()=>{const timer=setInterval(()=>{if(onlineRef.current&&sessionRef.current)void sync();},30000);return()=>clearInterval(timer);},[]);
  async function setTenantId(tenantId:string){
    if(sessionRef.current?.role!=='super_admin'||!worldRef.current.datasets[tenantId])return;
    const next={...sessionRef.current,tenantId};await mockSessionStorage.save(next);publishSession(next);setLeagueId(undefined);setPresentation('content');
  }
  async function setCart(value:CartLine[]|((previous:CartLine[])=>CartLine[])){
    if(!sessionRef.current)return;
    return withLock(async()=>{const current=actorFor(sessionRef.current!.role,sessionRef.current!.tenantId);const key=scopeKey(current);const previous=worldRef.current.carts[key]||[];const lines=typeof value==='function'?value(previous):value;
      if(lines.some(line=>!Number.isInteger(line.quantity)||line.quantity<1||line.quantity>10)){notify('Use quantities between 1 and 10.');return false;}
      const next=clone(worldRef.current);next.carts[key]=clone(lines);await mockStorage.saveWorld(prefRef.current.serverUrl,next);setCartUndo(clone(previous));publish(next);return true;},false);
  }
  async function addToCart(line:CartLine){
    const previous=worldRef.current.carts[scopeKey(actor)]||[];const existing=previous.find(x=>x.variant.variant_id===line.variant.variant_id);const quantity=(existing?.quantity||0)+line.quantity;
    const stock=data.products.flatMap(x=>x.variants).find(x=>x.variant_id===line.variant.variant_id)?.stock||0;
    if(quantity>stock||quantity>10){notify('This quantity is not available. Choose fewer items.');return;}
    const saved=await setCart(existing?previous.map(x=>x.variant.variant_id===line.variant.variant_id?{...x,quantity}:x):[...previous,line]);if(saved)notify('Added to your cart.');
  }
  async function undoCart(){if(cartUndo){const previous=cartUndo;setCartUndo(null);await setCart(previous);setCartUndo(null);notify('Cart change undone.');}}
  const setRole=async(next:Role)=>{const account=demoAccounts.find(x=>x.role===next)!;await login(account.email,demoPassword);};
  const setConnection=(value:Connection)=>{void changePreferences({...prefRef.current,simulateOffline:value==='offline'}).catch(()=>notify('Could not save the connection setting.'));};
  const setTheme=(value:Preferences['theme'])=>{void changePreferences({...prefRef.current,theme:value}).catch(()=>notify('Could not save the theme.'));};
  const pendingCount=data.queue.filter(x=>x.status==='pending').length;
  const configs=world.configs[actor.tenantId]||[];
  return {data,role,setRole,presentation,setPresentation,connection,setConnection,selectedLeague,setLeagueId,serverUrl:preferences.serverUrl,setServerUrl:changeServer,
    cart,setCart,message,setMessage,notify,addToCart,setTenantId,syncScenario,setSyncScenario,session,ready,bootError,retryBoot:load,busy,refreshing,resourceError,refresh,run,login,logout,sync,
    theme,themePreference:preferences.theme,setTheme,simulateOffline:preferences.simulateOffline,pendingCount,configs,failNext,setFailNext,expireSession:expire,undoCart,canUndoCart:!!cartUndo,
    unavailable:()=>notify('This operation is unavailable for the selected resource.')};
}
type PreviewValue=ReturnType<typeof usePreviewValue>;
const Context=createContext<PreviewValue|null>(null);
export function PreviewProvider({children,data}:{children:ReactNode;data?:ScreenData}){const value=usePreviewValue(data);return <Context.Provider value={value}>{children}</Context.Provider>;}
export function usePreview(){const value=useContext(Context);if(!value)throw new Error('PreviewProvider is missing');return value;}
