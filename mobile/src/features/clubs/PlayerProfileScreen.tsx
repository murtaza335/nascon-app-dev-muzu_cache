import { RouteProp,useRoute } from '@react-navigation/native';
import { useEffect,useState } from 'react';
import { View } from 'react-native';
import { useApp } from '../../app/AppContext';
import { Avatar,Badge,Button,Empty,Field,humanize,Row,Screen,Section,Sheet,T,ui } from '../../components/ui';
import type { StackParams } from '../../navigation/routes';
import { colors as c } from '../../theme/tokens';
export function PlayerProfileScreen() {
  const p = useApp();
  const r = useRoute<RouteProp<StackParams, 'PlayerProfile'>>();
  const id = r.params?.playerId || p.data.user?.player_id;
  const player = p.data.players.find(x => x.player_id === id);
  const history = p.data.history[id || ''];
  const allowed = !!player && (p.role === 'super_admin' || p.role === 'player' && id === p.data.user?.player_id || p.role === 'club_manager' && player.club_id === p.data.user?.club_id);
  const [edit, setEdit] = useState(false);
  const [name, setName] = useState('');
  const [position, setPosition] = useState('');
  useEffect(() => {
    if (id)
      void p.fetchHistory(id);
  }, [id, p.data.lastUpdated]);
  return <Screen title="Player" back skeleton="profile">

    {!player ? <Empty title="Player unavailable" body="Go back to the club roster and refresh its player list." /> : <>

      <View style={[ui.row, { alignItems: 'flex-start' }]}>

        <Avatar name={player.name} size={64} />

        <View style={[ui.grow, { gap: 8 }]}>

          <T variant="heading">

            {player.name}

          </T>

          <T color={c.secondary}>

            {player.position}

          </T>

          <View style={ui.wrap}>

            {player.role && <Badge label={humanize(player.role)} />}

            {player.on_loan && <Badge label="On loan" tone="info" />}

          </View>

        </View>

      </View>

      {allowed && <Button label="Edit player details" kind="secondary" onPress={() => {
        setName(player.name);
        setPosition(player.position);
        setEdit(true);
      }} />}

      <Section title="Registration">

        <Row title="Squad" detail={player.squad_id || 'Not currently registered'} />

        <Row title="Club" detail={p.data.clubs.find(x => x.club_id === player.club_id)?.name || 'Club not available'} />

      </Section>

      <Section title="Registration history">

        {history?.length ? history.map(item => <View key={item.audit_id} style={{ gap: 8, paddingBottom: 20, borderBottomWidth: 1, borderColor: c.divider }}>

          <View style={[ui.between, { flexWrap: 'wrap' }]}>

            <T variant="strong">

              {humanize(item.action)}

            </T>

            <Badge label={humanize(item.state)} />

          </View>

          <T>

            {item.why}

          </T>

          <T variant="caption" color={c.secondary}>{`${(item.effective_date)} · ${(item.who)}`}</T>

        </View>) : <Empty title={history ? 'No changes recorded' : 'History not saved yet'} body={history ? 'Registration changes and reasons will be kept here.' : 'Connect and refresh this player before making offline roster changes.'} icon="clock" />}

      </Section>

      <Sheet title="Edit player details" open={edit} onClose={() => setEdit(false)}>

        <Field label="Full name" value={name} onChangeText={setName} />

        <Field label="Position" value={position} onChangeText={setPosition} />

        <Button label="Save changes" disabled={!name.trim() || !position.trim() || p.connection === 'offline'} onPress={() => void p.run({ kind: 'editPlayer', playerId: player.player_id, name: name.trim(), position: position.trim() }).then(result => {
          if (result.ok)
            setEdit(false);
        })} />

        <Button label="Cancel" kind="quiet" onPress={() => setEdit(false)} />

      </Sheet>

    </>}

  </Screen>;
}
