import { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { usePreview } from '../../app/PreviewContext';
import { Button, Empty, Field, Message, Screen, Select } from '../../components/ui';
import type { AppNavigation } from '../../navigation/routes';
export function CompetitionSetupScreen(){
  const p=usePreview();const n=useNavigation<AppNavigation>();const [name,setName]=useState('');const [sport,setSport]=useState(p.data.leagues[0]?.sport_id);const [format,setFormat]=useState('round_robin');const [attempted,setAttempted]=useState(false);
  const sports=[...new Set(p.data.leagues.map(x=>x.sport_id).filter((x):x is string=>!!x))];
  if(!['super_admin','league_organizer'].includes(p.role))return <Screen title="Create competition" back><Empty title="Organizer access required" body="Only organizers can create competitions."/></Screen>;
  return <Screen title="Create competition" back><Message title="Start with the essentials" description="Create the competition, then add its season, divisions and stages. This is a local mock management flow."/><Field label="Competition name" value={name} onChangeText={setName} maxLength={200} error={attempted&&!name.trim()?'Enter a competition name.':undefined}/><Select label="Sport" value={sport} options={sports.map(value=>({value,label:value.replace(/_/g,' ')}))} onChange={setSport}/><Select label="Format" value={format} options={[{value:'round_robin',label:'Round robin'},{value:'single_elim',label:'Single elimination'}]} onChange={setFormat}/><Button label="Create competition" disabled={p.connection==='offline'} onPress={()=>{setAttempted(true);if(name.trim()&&sport)void p.run({kind:'league',name,sportId:sport,format}).then(result=>{if(result.ok&&result.id){p.setLeagueId(result.id);n.replace('CompetitionStructure',{leagueId:result.id});}});}}/></Screen>;
}
