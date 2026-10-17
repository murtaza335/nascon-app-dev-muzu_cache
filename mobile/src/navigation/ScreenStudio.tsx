import { useNavigation } from '@react-navigation/native';
import { View } from 'react-native';
import { roleNames, usePreview } from '../app/PreviewContext';
import { Badge, Chip, Row, Section, Select, Sheet, T, ui } from '../components/ui';
import type { AppNavigation } from './routes';
import type { Connection, Presentation, Role, SyncScenario } from '../types/preview';
import { colors as c } from '../theme/tokens';
import { canPreviewScreen, screenRegistry } from './screenRegistry';
export function ScreenStudio({open,onClose}:{open:boolean;onClose:()=>void}) {
  const p=usePreview();const n=useNavigation<AppNavigation>();
  return <Sheet title="Screen studio" open={open} onClose={onClose}><T color={c.secondary}>Presentation controls only. This lab switches demo accounts through local sign-in. Connectivity simulation does not change device settings.</T>
    <Select label="Switch demo account" value={p.role} options={Object.entries(roleNames).map(([value,label])=>({value,label}))} onChange={value=>void p.setRole(value as Role)}/>
    <Section title="Screen state"><View style={ui.wrap}>{(['content','loading','empty','error','success'] as Presentation[]).map(x=><Chip key={x} label={x[0].toUpperCase()+x.slice(1)} selected={p.presentation===x} onPress={()=>p.setPresentation(x)}/>)}</View></Section>
    <Select label="Connection simulation" value={p.simulateOffline?'offline':'online'} options={[{value:'online',label:'Use device connectivity'},{value:'offline',label:'Simulate offline'}]} onChange={value=>p.setConnection(value as Connection)}/>
    <Section title="Recovery testing"><Chip label={p.failNext?'Next request will fail':'Fail the next request'} selected={p.failNext} onPress={()=>p.setFailNext(!p.failNext)}/><Row title="Expire this demo session" detail="Retains pending work and returns to sign-in" onPress={()=>{onClose();void p.expireSession();}}/></Section>
    <Section title="All 31 screens">{screenRegistry.map(item=><Row key={item.id} title={item.title} detail={canPreviewScreen(item.id,p.role)?'Open screen':'Switch to an authorized preview role'} trailing={!canPreviewScreen(item.id,p.role)?<Badge label="Role-specific"/>:undefined} onPress={()=>{if(!canPreviewScreen(item.id,p.role)){p.notify('Select Manager or Organizer to preview the corresponding management screens.');return;}onClose();if('tab'in item && item.tab==='Roster' && p.role==='super_admin'){n.navigate('RosterManagement');}else if('tab'in item){n.reset({index:0,routes:[{name:'Main',params:{screen:item.tab}}]});}else if(item.screen==='Login'){void p.logout(false);}else{n.navigate(item.screen as 'Settings');}}}/>)}</Section>
  </Sheet>;
}
