import { useNavigation } from '@react-navigation/native';
import { View } from 'react-native';
import { roleNames,useApp } from '../../app/AppContext';
import { Avatar,Badge,Row,Screen,Section,T,ui } from '../../components/ui';
import type { AppNavigation } from '../../navigation/routes';
import { colors as c } from '../../theme/tokens';
export function AccountScreen() {
  const p = useApp();
  const n = useNavigation<AppNavigation>();
  return <Screen title="Your account" back stateful={false}>

    <View style={{ backgroundColor: c.olive, padding: 24, borderRadius: 16, gap: 16 }}>
      <View style={ui.row}>
        <Avatar name={p.data.user?.display_name} size={56} />
        <View style={ui.grow}>
          <T variant="title">
            {p.data.user?.display_name || 'Your account'}
          </T>
          <T variant="caption" color={c.secondary}>
            {p.data.user?.email}
          </T>
        </View>
      </View>
      <Badge label={roleNames[p.role]} />
      <T color={c.secondary}>
        {p.data.tenant?.name || (p.role === 'super_admin' ? 'Choose an organization from Home' : 'Organization unavailable')}
      </T>
    </View>

    <Section title="Club">
      {!!p.data.user?.club_id && <Row title="My club" icon="roster" onPress={() => n.navigate('ClubProfile', { clubId: p.data.user!.club_id! })} />}
      {!!p.data.user?.player_id && <Row title="My player profile" icon="person" onPress={() => n.navigate('PlayerProfile', { playerId: p.data.user!.player_id! })} />}
      {['super_admin', 'club_manager', 'league_organizer'].includes(p.role) && <Row title="Management" icon="score" onPress={() => n.navigate('Management')} />}
      {!p.data.user?.club_id && !p.data.user?.player_id && <Row title="Explore clubs" icon="roster" onPress={() => n.navigate('Main', { screen: 'Club' })} />}
    </Section>

    <Section title="Shopping">
      <Row title="Orders and receipts" detail={`${p.data.orders.length} accessible orders`} icon="store" onPress={() => n.navigate('Orders')} />
      <Row title="Your cart" detail={`${p.cart.reduce((sum, line) => sum + line.quantity, 0)} selected items`} icon="store" onPress={() => n.navigate('Cart')} />
    </Section>

    <Section title="Device">
      <Row title="Sync centre" detail={`${p.pendingCount} pending actions on this device`} icon="sync" onPress={() => n.navigate('SyncStatus')} />
      <Row title="Settings and sign out" icon="settings" onPress={() => n.navigate('Settings')} />
    </Section>

  </Screen>;
}
