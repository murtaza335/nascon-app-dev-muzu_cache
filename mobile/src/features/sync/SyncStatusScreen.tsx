import { useState } from 'react';
import { View } from 'react-native';
import { useApp } from '../../app/AppContext';
import { Badge, Button, Card, dateLabel, Empty, humanize, Message, Row, Screen, Section, Sheet, T, Tone, ui } from '../../components/ui';
import type { QueueItem } from '../../types/models';
import { colors as c } from '../../theme/tokens';
const tones:Record<QueueItem['status'],Tone>={pending:'warning',applied:'success',rejected:'error',duplicate:'neutral',deferred:'info'};
// MOB-09/12: durable outbox and server-reported outcomes.
export function SyncStatusScreen() {
  const p=useApp();const pending=p.data.queue.filter(x=>x.status==='pending');const results=p.data.queue.filter(x=>x.status!=='pending');const [detail,setDetail]=useState<QueueItem|null>(null);
  return <Screen title="Sync status" subtitle="Know where your work stands" back stateful showStatus={false}>
    <Card style={{backgroundColor:c.olive}}><View style={ui.between}><T variant="section">{humanize(p.connection)}</T><Badge label="Saved on this device"/></View><View style={{gap:4}}><T variant="score">{pending.length}</T><T color={c.secondary}>{pending.length===1?'action waiting to sync':'actions waiting to sync'}</T></View><Button label={p.connection==='syncing'?'Syncing…':'Sync now'} icon="sync" disabled={!pending.length||p.connection!=='online'} busy={p.connection==='syncing'} onPress={()=>void p.sync()}/></Card>
    {p.connection==='offline'&&<Message title="You’re offline" description="Pending actions are saved on this device. They survive an app restart and sync when this account reconnects." tone="warning"/>}
    <Section title="Pending actions">{pending.length?pending.map(item=><Row key={item.action_id} title={item.label} detail={dateLabel(item.queued_at)} icon="clock" onPress={()=>setDetail(item)} trailing={<Badge label="Pending" tone="warning"/>}/>):<Empty title="Nothing waiting on you" body="Pending score and roster actions will appear here, clearly separate from accepted changes." icon="sync"/>}</Section>
    <Section title="Recent outcomes">{results.length?results.map(item=><Row key={item.action_id} title={item.label} detail={item.reason||humanize(item.status)} onPress={()=>setDetail(item)} trailing={<Badge label={humanize(item.status)} tone={tones[item.status]}/>}/>):<T color={c.secondary}>Applied, rejected and duplicate action results will appear here after sync.</T>}</Section>
    <Sheet title="Action details" open={!!detail} onClose={()=>setDetail(null)}>{detail&&<><Badge label={humanize(detail.status)} tone={tones[detail.status]}/><T variant="section">{detail.label}</T><Row title="Queued" detail={dateLabel(detail.queued_at)}/><Row title="Action ID" detail={detail.action_id}/>{detail.reason&&<Message title={detail.status==='rejected'?'Why this was rejected':'Result details'} description={detail.reason} tone={tones[detail.status]}/>}<Button label="Done" kind="secondary" onPress={()=>setDetail(null)}/></>}</Sheet>
  </Screen>;
}
