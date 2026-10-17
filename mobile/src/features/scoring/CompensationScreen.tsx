import { useEffect, useState } from 'react';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { useApp } from '../../app/AppContext';
import { Badge, Button, Card, Empty, Field, humanize, Message, Row, Screen, Section, Select, Sheet, T } from '../../components/ui';
import type { AppNavigation, StackParams } from '../../navigation/routes';
import { colors as c } from '../../theme/tokens';
export function CompensationScreen() {
  const p=useApp();const n=useNavigation<AppNavigation>();const r=useRoute<RouteProp<StackParams,'Compensation'>>();const match=p.data.fixtures.find(x=>x.match_id===r.params?.matchId) || (!r.params?.matchId ? p.data.fixtures.find(x=>x.status==='in_progress') : undefined);
  const [eventId,setEventId]=useState(r.params?.eventId || match?.events?.find(x=>!x.compensated&&x.type==='score')?.event_id);const [reason,setReason]=useState('');const [confirm,setConfirm]=useState(false);const [submitted,setSubmitted]=useState(false);
  const events=(match?.events||[]).filter(x=>!x.compensated&&['score','discipline','tiebreak_winner'].includes(x.type));const event=events.find(x=>x.event_id===eventId);
  const allowed=p.role==='super_admin'||(p.role==='league_organizer'&&!!match&&!!p.data.user?.league_ids?.includes(match.league_id));
  useEffect(()=>{if(match?.match_id)return p.watchMatch(match.match_id);},[match?.match_id]);
  if(!['league_organizer','super_admin'].includes(p.role))return <Screen title="Correct event" back><Empty title="Organizer access required" body="You can correct events only in leagues you organize." icon="score"/></Screen>;
  return <Screen title="Correct an event" back><T variant="heading">Keep the story accurate.</T><T color={c.secondary}>A correction appends a new event. The original stays in the timeline with a clear explanation.</T><Section title="Original event"><Select label="Event to correct" value={eventId} options={events.map(x=>({value:x.event_id,label:`${x.sequence}. ${x.label||humanize(x.type)}`}))} onChange={setEventId}/><Card><Badge label="Original record"/><T variant="strong">{event?.label||'Choose an eligible event'}</T><T color={c.secondary}>{event?`Event ${event.sequence} · ${humanize(event.type)}`:'Events already corrected or ineligible for correction are excluded.'}</T></Card></Section><Field label="Reason for correction" placeholder="Explain what needs to be corrected" multiline numberOfLines={4} maxLength={500} value={reason} onChangeText={setReason} error={submitted&&!reason.trim()?'Enter a reason for the correction.':undefined}/>
    {p.connection==='offline'&&<Message title="Offline correction" description="The original event must be available locally before a correction can be queued in the app." tone="warning"/>}<Button label="Review correction" disabled={!event||!allowed} onPress={()=>{setSubmitted(true);if(reason.trim())setConfirm(true);}}/>
    <Sheet title="Confirm correction?" open={confirm} onClose={()=>setConfirm(false)}><Row title="Original event" detail={event?.label||event?.event_id}/><T>{reason}</T><Message title="History will remain visible" description="The original event is marked corrected; it is not deleted."/><Button label="Confirm correction" onPress={()=>{if(match&&eventId)void p.run({kind:'score',matchId:match.match_id,eventType:'compensation',targetId:eventId,reason}).then(result=>{if(result.ok){setConfirm(false);if(result.queued)n.navigate('SyncStatus');else n.navigate('MatchDetail',{matchId:match.match_id});}});}}/><Button label="Keep editing" kind="quiet" onPress={()=>setConfirm(false)}/></Sheet>
  </Screen>;
}
