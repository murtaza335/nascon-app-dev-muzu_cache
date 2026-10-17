import { useState } from 'react';
import { usePreview } from '../../app/PreviewContext';
import { Button, Card, Field, Message, Row, Screen, Section, Select, Sheet, T } from '../../components/ui';
import { useNavigation } from '@react-navigation/native';
import type { AppNavigation } from '../../navigation/routes';
import { ScreenStudio } from '../../navigation/ScreenStudio';
import { colors as c } from '../../theme/tokens';
export function SettingsScreen(){
  const p=usePreview();const n=useNavigation<AppNavigation>();const [url,setUrl]=useState(p.serverUrl);const [error,setError]=useState('');const [confirm,setConfirm]=useState<'server'|'logout'|null>(null);const [studio,setStudio]=useState(false);
  function reviewServer(){try{const parsed=new URL(url);if(!['http:','https:'].includes(parsed.protocol)||parsed.username||parsed.password||parsed.search||parsed.hash)throw new Error();setError('');setConfirm('server');}catch{setError('Use an http:// or https:// address without credentials, queries or fragments.');}}
  return <Screen title="Settings" back showStatus={!!p.session} stateful={false}>
    <Section title="Appearance"><Select label="App theme" value={p.themePreference} options={[{value:'dark',label:'Matchday dark'},{value:'light',label:'Daylight'},{value:'system',label:'Follow device'}]} onChange={value=>p.setTheme(value as 'dark'|'light'|'system')}/><T color={c.secondary}>Your choice is saved on this device. Text follows your system font size.</T></Section>
    <Section title="Your server"><Field label="Server address" value={url} onChangeText={setUrl} keyboardType="url" autoCapitalize="none" autoCorrect={false} error={error||undefined} helper="Each address has its own separate mock workspace."/><Button label="Save address" disabled={url.trim().replace(/\/+$/,'')===p.serverUrl} onPress={reviewServer}/></Section>
    {p.session&&<><Section title="Account and work"><Card><Row title="Account" icon="person" detail="Profile and organization context" onPress={()=>n.navigate('Account')}/><Row title="Sync status" icon="sync" detail={`${p.pendingCount} pending actions`} onPress={()=>n.navigate('SyncStatus')}/><Row title="Sign out" icon="back" detail="Safely leave this account" onPress={()=>setConfirm('logout')}/></Card></Section>
    <Section title="Mock environment"><Message title="Local mock mode" description="All data and payments are synthetic. Your saved workspace remains available after an app reload."/><Select label="Connection simulation" value={p.simulateOffline?'offline':'device'} options={[{value:'device',label:'Use device connectivity'},{value:'offline',label:'Simulate offline'}]} onChange={value=>p.setConnection(value==='offline'?'offline':'online')}/><Button label="Refresh saved information" kind="secondary" busy={p.refreshing} onPress={()=>void p.refresh()}/><Button label="Open screen studio" kind="quiet" onPress={()=>setStudio(true)}/></Section></>}
    <Sheet title={confirm==='server'?'Change server context?':'Sign out safely'} open={!!confirm} onClose={()=>setConfirm(null)}>
      <T>{confirm==='server'?'Changing server signs you out. Pending work stays with the previous address and will never be sent to this one.':p.pendingCount?`You have ${p.pendingCount} pending actions. Keep them for your next sign-in, or explicitly discard them.`:'Your cart will be cleared. Saved mock server records remain available when you sign in again.'}</T>
      <Button label={confirm==='server'?'Change server and sign out':'Sign out and keep pending work'} onPress={()=>{void (confirm==='server'?p.setServerUrl(url):p.logout(false)).then(ok=>{if(ok)setConfirm(null);});}}/>
      {confirm==='logout'&&p.pendingCount>0&&<Button label="Discard pending work and sign out" kind="danger" onPress={()=>void p.logout(true).then(ok=>{if(ok)setConfirm(null);})}/>}
      <Button label="Cancel" kind="quiet" onPress={()=>setConfirm(null)}/>
    </Sheet><ScreenStudio open={studio} onClose={()=>setStudio(false)}/>
  </Screen>;
}
