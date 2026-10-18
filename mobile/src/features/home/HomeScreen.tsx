import { useNavigation } from '@react-navigation/native';
import { View } from 'react-native';
import { useApp } from '../../app/AppContext';
import { Button,Empty,Row,Screen,Section,Select,T,humanize,money } from '../../components/ui';
import type { AppNavigation } from '../../navigation/routes';
import { colors as c } from '../../theme/tokens';
import { MatchCard } from '../fixtures/components/MatchCard';
import { ExploreSection,WorkSection } from './components/DashboardSections';
import { dashboardMatches } from './selectors';
export function HomeScreen() {
  const p = useApp();
  const n = useNavigation<AppNavigation>();
  const matches = dashboardMatches(p.data, p.role);
  const next = matches[0];
  const recentOrders = [...p.data.orders].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')).slice(0, 2);
  return <Screen title="Home">

    {p.role === 'super_admin' && <Select label="Active organization" value={p.session?.tenantId || undefined} options={(p.data.tenants || []).map(t => ({ value: t.tenant_id, label: t.name }))} onChange={value => void p.setTenantId(value)} placeholder="Choose an organization" />}

    {!!p.pendingCount && <View style={{ backgroundColor: c.warningBg, borderRadius: 12, padding: 16, gap: 8 }}>
      <T variant="strong" color={c.warning}>
        {`${p.pendingCount} actions need syncing`}
      </T>
      <T color={c.warning}>
        Your work is saved on this device. Review each result after reconnecting.
      </T>
      <Button label="Review pending work" kind="quiet" onPress={() => n.navigate('SyncStatus')} />
    </View>}

    <WorkSection />

    <Section title="Live & discover">
      <Button label="Scan a match or athlete QR" kind="secondary" onPress={() => n.navigate('QRScanner')} />
      <Button label="Creator studio" kind="secondary" onPress={() => n.navigate('GoLive')} />
      {p.session && <Button label="Create or join a co-stream" kind="secondary" onPress={() => n.navigate('CoStreamEntry')} />}
      {p.session && <Button label={p.notifications.length ? `Notifications (${p.notifications.length})` : 'Notifications'} kind="quiet" onPress={() => n.navigate('Notifications')} />}
      {next?.status === 'in_progress' && <Button label="Watch this match live" onPress={() => n.navigate('MatchLive', { matchId: next.match_id })} />}
    </Section>

    <Section title={next?.status === 'in_progress' ? 'Match in progress' : 'Next match'} action="All fixtures" onAction={() => n.navigate('Main', { screen: 'Fixtures' })}>

      {next ? <>
        <T variant="caption" color={c.secondary}>
          {p.data.leagues.find(l => l.league_id === next.league_id)?.name}
          {next.scheduled_at ? ` / ${new Date(next.scheduled_at).toLocaleDateString('en-PK', { day: 'numeric', month: 'short' })}` : ''}
        </T>
        <MatchCard match={next} featured />
      </> : <Empty title="No upcoming matches" body="Your next scheduled or live match will appear here. You can still explore fixtures and completed results." />}

    </Section>

    <ExploreSection />

    {recentOrders.length > 0 && <Section title="Recent orders" action="View all" onAction={() => n.navigate('Orders')}>
      {recentOrders.map(order => <Row key={order.order_id} title={order.order_id} detail={`${humanize(order.status)} / ${order.items.reduce((sum, item) => sum + item.quantity, 0)} items`} trailing={<T variant="strong">
        {money(order.total_minor, order.currency)}
      </T>} onPress={() => n.navigate('OrderDetail', { orderId: order.order_id })} />)}
    </Section>}

  </Screen>;
}
