import { useNavigation,useRoute } from '@react-navigation/native';
import { View } from 'react-native';
import { useApp } from '../../app/AppContext';
import { Badge,Button,Empty,humanize,LeaguePicker,Row,Screen,Section,T,ui } from '../../components/ui';
import type { AppNavigation } from '../../navigation/routes';
import { colors as c } from '../../theme/tokens';
export function RosterScreen() {
  const p = useApp();
  const n = useNavigation<AppNavigation>();
  const route = useRoute();
  const requested = (route.params as {
    clubId?: string;
  } | undefined)?.clubId;
  const club = p.data.clubs.find(x => x.club_id === (requested || p.data.user?.club_id)) || (p.role === 'super_admin' ? p.data.clubs[0] : undefined);
  const allowed = p.role === 'super_admin' || p.role === 'club_manager' && club?.club_id === p.data.user?.club_id;
  const registrations = (p.data.registrations || []).filter(x => x.league_id === p.selectedLeague?.league_id);
  const roster = (club?.roster || []).filter(x => registrations.some(r => r.player_id === x.player_id && r.squad_id === x.squad_id));
  return <Screen title="Roster" subtitle={club?.name} back={route.name === 'RosterManagement'}>

    {!allowed ? <Empty title="Manager access required" body="Open the roster of a club you manage." icon="roster" /> : <>

      <LeaguePicker />

      <Button label="Add player" icon="plus" onPress={() => n.navigate('AddPlayer')} />

      <Section title={`${roster.length} registered players`}>

        {roster.length ? roster.map(player => <View key={`${player.player_id}:${player.squad_id}`} style={{ gap: 8, paddingBottom: 12, borderBottomWidth: 1, borderColor: c.divider }}>

          <Row title={player.name} detail={player.position} icon="person" onPress={() => n.navigate('PlayerProfile', { playerId: player.player_id })} />

          <View style={[ui.between, { flexWrap: 'wrap' }]}>

            <Badge label={player.on_loan ? 'On loan' : humanize(player.role || 'Registered')} tone={player.on_loan ? 'info' : 'neutral'} />

            <Button label="Registration" kind="quiet" onPress={() => n.navigate('RosterAction', { playerId: player.player_id })} />

          </View>

        </View>) : <Empty title="No players in this competition" body="Choose another competition or add a player registration." icon="roster" />}

      </Section>

      <Section title="Registration changes">

        <T color={c.secondary}>

          Transfers, loans and releases keep a permanent history. Offline changes remain pending until accepted by the server.

        </T>

        <Button label="View pending work" kind="secondary" onPress={() => n.navigate('SyncStatus')} />

      </Section>

    </>}

  </Screen>;
}
