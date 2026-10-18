import { useNavigation,useRoute } from '@react-navigation/native';
import { useState } from 'react';
import { Linking,ScrollView,View } from 'react-native';
import { useApp } from '../../app/AppContext';
import { Avatar,Badge,Button,Chip,Empty,Field,Metric,Row,Screen,Section,Select,T,humanize,ui } from '../../components/ui';
import type { AppNavigation } from '../../navigation/routes';
import { colors as c } from '../../theme/tokens';
import { ClubRosterRow } from './components/ClubRosterRow';
export function ClubProfileScreen() {
  const p = useApp();
  const n = useNavigation<AppNavigation>();
  const route = useRoute();
  const requested = (route.params as {
    clubId?: string;
  } | undefined)?.clubId;
  const [chosen, setChosen] = useState(requested || p.data.user?.club_id || undefined);
  const [tab, setTab] = useState('Overview');
  const [query, setQuery] = useState('');
  const club = p.data.clubs.find(x => x.club_id === chosen) || (!chosen ? p.data.clubs[0] : undefined);
  const manage = !!club && (p.role === 'super_admin' || p.role === 'club_manager' && club.club_id === p.data.user?.club_id);
  const players = (club?.roster || []).filter(x => `${x.name} ${x.position}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  return <Screen title="Club" back={route.name === 'ClubProfile'} skeleton="profile">

    {p.data.clubs.length > 1 && <Select label="Select club" value={club?.club_id} options={p.data.clubs.map(x => ({ value: x.club_id, label: x.name }))} onChange={setChosen} />}

    {!club ? <Empty title="Find your club here" body="Your organization's clubs will appear once available. You can still use Account and explore the competitions." action="Refresh clubs" onAction={() => void p.refresh()} icon="roster" /> : <>

      <View style={{ backgroundColor: c.darkSurface, borderRadius: 16, padding: 16, gap: 12 }}>
        <View style={[ui.row, { alignItems: 'flex-start' }]}>
          <Avatar name={club.name} size={48} background={c.darkRaised} color={c.onDarkSurface} />
          <View style={[ui.grow, { gap: 4 }]}>
            <T variant="title" color={c.onDarkSurface}>{club.name}</T>
            <T variant="caption" color={c.darkMuted}>{club.home_venue?.name || 'Home venue not provided'}</T>
            {club.home_venue?.lat != null && club.home_venue?.lng != null && (
              <T variant="caption" color={c.darkMuted}>{`${club.home_venue.lat}, ${club.home_venue.lng}`}</T>
            )}
          </View>
        </View>
        <View style={ui.wrap}>
          <Badge label={`${club.roster.length} players`} />
          <Badge label={`${club.staff.length} staff`} />
        </View>

        {manage && <Button onDark kind="secondary" label="Manage roster" icon="roster" onPress={() => n.navigate('RosterManagement', { clubId: club.club_id })} />}

      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8 }}>
        {['Overview', 'Roster', 'Staff'].map(label => <Chip key={label} label={label} selected={tab === label} onPress={() => setTab(label)} />)}
      </ScrollView>

      {tab === 'Overview' && <>

        <Section title="Season record">
          {club.stats_by_season?.length ? club.stats_by_season.map(season => <View key={season.season} style={{ gap: 16, paddingBottom: 20, borderBottomWidth: 1, borderColor: c.divider }}>
            <T variant="strong">
              {season.season}
            </T>
            <View style={ui.wrap}>
              <Metric label="Played" value={season.played} />
              <Metric label="Won" value={season.won} />
              <Metric label="Drawn" value={season.drawn} />
              <Metric label="Lost" value={season.lost} />
            </View>
          </View>) : <T color={c.secondary}>
            Season records appear as your club's matches are completed.
          </T>}
        </Section>

        {!!club.socials && Object.keys(club.socials).length > 0 && <Section title="Follow the club">
          {Object.entries(club.socials).map(([name, url]) => <Row key={name} title={humanize(name)} detail={url} onPress={() => {
            if (/^https?:\/\//i.test(url))
              void Linking.openURL(url).catch(() => p.notify('Could not open this link.'));
            else
              p.notify('This link is not a web address.');
          }} />)}
        </Section>}

      </>}

      {tab === 'Roster' && <Section title="Club players">
        <Field label="Find a player" placeholder="Search name or position" value={query} onChangeText={setQuery} />
        {players.length ? players.map(player => <ClubRosterRow key={`${player.player_id}:${player.squad_id}`} player={player} />) : <Empty title="No players found" body="Try another name or position. Registered players will appear here." icon="roster" />}
      </Section>}

      {tab === 'Staff' && <Section title="Behind the club">
        {club.staff.length ? club.staff.map((staff, i) => <Row key={`${staff.name}:${i}`} title={staff.name} detail={humanize(staff.role)} icon="person" />) : <Empty title="Staff details not added" body="Coaches, managers and support staff will appear here." icon="person" />}
      </Section>}

    </>}

  </Screen>;
}
