import { useState } from 'react';
import { View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useApp } from '../../app/AppContext';
import { Avatar, Badge, Button, Card, Empty, humanize, Metric, Row, Screen, Section, Select, T, ui } from '../../components/ui';
import type { AppNavigation } from '../../navigation/routes';
import { colors as c } from '../../theme/tokens';
export function ClubProfileScreen() {
  const p = useApp(); const n = useNavigation<AppNavigation>(); const route = useRoute();
  const param = route.params as { clubId?: string } | undefined;
  const [clubId, setClubId] = useState(param?.clubId || p.data.user?.club_id || p.data.clubs[0]?.club_id);
  const club = p.data.clubs.find(x => x.club_id === clubId) ?? p.data.clubs[0];
  const canManage = p.role === 'super_admin' || (p.role === 'club_manager' && club?.club_id === p.data.user?.club_id);
  return <Screen title="Club & community" back={route.name === 'ClubProfile'} stateful skeleton="profile" action={<Button label="Account" kind="quiet" onPress={() => n.navigate('Account')} />}>
    {p.data.clubs.length > 1 && <Select label="Club" value={club?.club_id} options={p.data.clubs.map(x => ({ value:x.club_id,label:x.name }))} onChange={setClubId} />}
    <View style={{ alignItems: 'center', gap: 16, paddingVertical: 12 }}><Avatar name={club?.name} size={76} /><T variant="heading" style={{ textAlign:'center' }}>{club?.name || 'No club selected'}</T><T color={c.secondary}>{p.data.tenant?.name || ''}</T>{club && <Badge label={`${club.roster.length} active players`} />}</View>
    {canManage && <Button label="Manage roster" icon="roster" onPress={() => p.role==='super_admin' ? n.navigate('RosterManagement', { clubId: club?.club_id }) : n.navigate('Main', { screen:'Roster' })} />}
    <Section title="Home ground"><Card><T variant="strong">{club?.home_venue?.name || 'Venue not provided'}</T><T color={c.secondary}>{club?.home_venue ? 'Venue details supplied by your club.' : 'Home venue information will appear here.'}</T>{club?.home_venue?.lat != null && club.home_venue.lng != null && <T variant="caption" color={c.muted}>{club.home_venue.lat}, {club.home_venue.lng}</T>}</Card></Section>
    <Section title="Active roster">{club?.roster.length ? club.roster.map(player => <Row key={player.player_id} title={player.name} detail={`${player.position}${player.role ? ` · ${humanize(player.role)}` : ''}${player.on_loan ? ' · On loan' : ''}`} icon="person" onPress={() => n.navigate('PlayerProfile', { playerId:player.player_id })} />) : <Empty title="Meet the team" body="Players and their roles will appear here when roster information is available." icon="roster" />}</Section>
    <Section title="Behind the team">{club?.staff.length ? club.staff.map((staff,i) => <Row key={`${staff.name}-${i}`} title={staff.name} detail={humanize(staff.role)} icon="person" />) : <T color={c.secondary}>Coaches, managers and support staff will appear here.</T>}</Section>
    <Section title="Across the seasons">{club?.stats_by_season?.length ? club.stats_by_season.map(season => <Card key={season.season}><T variant="strong">{season.season}</T><View style={[ui.wrap, { gap: 16 }]}><Metric value={season.played} label="Played" /><Metric value={season.won} label="Won" /><Metric value={season.drawn} label="Drawn" /><Metric value={season.lost} label="Lost" /></View></Card>) : <T color={c.secondary}>Season history will appear as your club’s records become available.</T>}</Section>
    {!!club?.socials && <Section title="Find your club">{Object.entries(club.socials).map(([name,url]) => <Row key={name} title={humanize(name)} detail={url} />)}</Section>}
  </Screen>;
}
