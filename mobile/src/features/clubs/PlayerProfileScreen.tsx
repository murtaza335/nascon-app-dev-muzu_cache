import { useState } from 'react';
import { View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { usePreview } from '../../app/PreviewContext';
import { Avatar, Badge, Button, Card, Empty, Field, humanize, Row, Screen, Section, Select, Sheet, T, ui } from '../../components/ui';
import type { AppNavigation, StackParams } from '../../navigation/routes';
import { colors as c } from '../../theme/tokens';
export function PlayerProfileScreen() {
  const p=usePreview(); const n=useNavigation<AppNavigation>(); const route=useRoute<RouteProp<StackParams,'PlayerProfile'>>();
  const id=route.params?.playerId || p.data.user?.player_id || p.data.players[0]?.player_id; const player=[...p.data.players,...p.data.clubs.flatMap(x=>x.roster)].find(x=>x.player_id===id);
  const history=p.data.history[id || ''] || [];
  const canEdit=p.role==='super_admin'||(p.role==='player'&&id===p.data.user?.player_id)||(p.role==='club_manager'&&!!player&&player.club_id===p.data.user?.club_id);
  const [assignedRole,setAssignedRole]=useState(player?.role||'substitute');const [edit,setEdit]=useState(false); const [name,setName]=useState(player?.name || ''); const [position,setPosition]=useState(player?.position || '');
  return <Screen title="Player profile" back stateful><View style={{alignItems:'center',gap:16,paddingVertical:16}}><Avatar name={player?.name} size={76}/><T variant="heading">{player?.name || 'Player profile'}</T><T color={c.secondary}>{player?.position || 'Player details will appear here'}</T>{player?.role&&<Badge label={humanize(player.role)}/>} {player?.on_loan&&<Badge label="On loan" tone="info"/>}</View>
    {canEdit&&<Button label="Edit player details" kind="secondary" onPress={()=>setEdit(true)}/>}
    <Section title="Registration"><Card><Row title="Current squad" detail={player?.squad_id || 'Not available'}/><View style={ui.divider}/><Row title="Registration status" detail={player ? player.on_loan?'Loan registration':'Club registration':'Awaiting player information'}/></Card></Section>
    {player&&['club_manager','super_admin'].includes(p.role)&&canEdit&&<Section title="Squad role"><Select label="Player role" value={assignedRole} options={['captain','vice_captain','starter','substitute'].map(value=>({value,label:humanize(value)}))} onChange={setAssignedRole}/><Button label="Assign role" kind="secondary" disabled={p.connection==='offline'} onPress={()=>void p.run({kind:'playerRole',playerId:player.player_id,role:assignedRole})}/></Section>}
    <Section title="Player history">{history.length?history.map(item=><Card key={item.audit_id}><View style={ui.between}><T variant="strong" style={ui.grow}>{humanize(item.action)}</T><Badge label={humanize(item.state)}/></View><T color={c.secondary}>{item.why}</T><T variant="caption" color={c.muted}>{item.effective_date} · {item.who}</T></Card>):<Empty title="A story still to come" body="Registration changes and their reasons will remain visible here." icon="clock"/>}</Section>
    <Sheet title="Edit player" open={edit} onClose={()=>setEdit(false)}><Field label="Full name" value={name} onChangeText={setName}/><Field label="Position" value={position} onChangeText={setPosition}/><Button label="Save changes" disabled={!name.trim()||!position.trim()} onPress={()=>{if(id)void p.run({kind:'editPlayer',playerId:id,name,position}).then(result=>{if(result.ok)setEdit(false);});}}/><Button label="Cancel" kind="quiet" onPress={()=>setEdit(false)}/></Sheet>
  </Screen>;
}
