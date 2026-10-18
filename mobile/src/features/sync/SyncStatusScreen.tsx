import { useState } from 'react';
import { View } from 'react-native';
import { useApp } from '../../app/AppContext';
import { Badge,Button,Chip,Empty,Message,Row,Screen,Section,Sheet,T,dateLabel,humanize,ui } from '../../components/ui';
import { colors as c } from '../../theme/tokens';
import type { QueueItem } from '../../types/models';
export function SyncStatusScreen() {
  const p = useApp();
  const [tab, setTab] = useState('pending');
  const [selected, setSelected] = useState<QueueItem>();
  const pending = p.data.queue.filter(x => x.status === 'pending');
  const completed = p.data.queue.filter(x => x.status !== 'pending');
  const rows = tab === 'pending' ? pending : completed;
  const tone = (status: string) => status === 'rejected' ? 'error' as const : ['pending', 'deferred'].includes(status) ? 'warning' as const : 'success' as const;
  return <Screen title="Sync centre" back stateful={false}>

    <View style={{ backgroundColor: c.olive, padding: 24, borderRadius: 16, gap: 12 }}>
      <Badge label={p.connection === 'offline' ? 'Offline' : p.connection === 'syncing' ? 'Syncing' : 'Connected'} tone={p.connection === 'offline' ? 'warning' : 'success'} />
      <T variant="heading">
        {pending.length ? `${pending.length} actions waiting` : 'No pending actions'}
      </T>
      <T color={c.secondary}>
        {p.connection === 'offline' ? 'Your work stays on this device. Reconnect to send it safely.' : 'Work syncs automatically. Every action has its own server result.'}
      </T>
      <Button label={p.connection === 'syncing' ? 'Syncing work' : 'Sync now'} disabled={!pending.length || p.connection === 'offline' || p.connection === 'syncing'} busy={p.connection === 'syncing'} onPress={() => void p.sync()} />
    </View>

    <View style={ui.wrap}>
      <Chip label={`Pending (${pending.length})`} selected={tab === 'pending'} onPress={() => setTab('pending')} />
      <Chip label={`Results (${completed.length})`} selected={tab === 'results'} onPress={() => setTab('results')} />
    </View>

    <Section title={tab === 'pending' ? 'Saved on this device' : 'Recent server outcomes'}>
      {rows.length ? rows.map(item => <Row key={item.action_id} title={item.label} detail={item.reason || dateLabel(item.queued_at)} trailing={<Badge label={humanize(item.status)} tone={tone(item.status)} />} onPress={() => setSelected(item)} />) : <Empty title={tab === 'pending' ? 'Nothing waiting to sync' : 'No results yet'} body={tab === 'pending' ? 'Queued scoring and registration actions will appear here.' : 'After syncing, review applied, duplicate or rejected actions here.'} icon="sync" />}
    </Section>

    <Sheet title="Action details" open={!!selected} onClose={() => setSelected(undefined)}>
      {selected && <>
        <Badge label={humanize(selected.status)} tone={tone(selected.status)} />
        <Row title="Action" detail={selected.label} />
        <Row title="Reference" detail={selected.action_id} />
        <Row title="Queued" detail={dateLabel(selected.queued_at)} />
        {selected.reason && <Message title="Server result" description={selected.reason} tone={tone(selected.status)} />}
        <T color={c.secondary}>
          {selected.status === 'pending' ? 'This action is safely queued.' : 'Rejected actions remain in history and are not retried automatically.'}
        </T>
        <Button label="Close details" kind="secondary" onPress={() => setSelected(undefined)} />
      </>}
    </Sheet>

  </Screen>;
}
