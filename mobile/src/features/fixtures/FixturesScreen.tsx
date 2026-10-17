import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { usePreview } from '../../app/PreviewContext';
import { Avatar, Badge, Button, Card, Chip, dateLabel, Empty, humanize, Screen, Select, T, ui } from '../../components/ui';
import { Icon } from '../../components/Icon';
import type { AppNavigation, TabParams } from '../../navigation/routes';
import type { Fixture } from '../../types/preview';
import { colors as c } from '../../theme/tokens';
export function FixtureRow({ match }: { match: Fixture }) {
  const n = useNavigation<AppNavigation>(); const p = usePreview();
  return <Pressable accessibilityRole="button" accessibilityLabel={`${match.home_name || match.home_team_id} versus ${match.away_name || match.away_team_id}, ${humanize(match.status)}. Open match`} onPress={() => n.navigate('MatchDetail', { matchId: match.match_id })} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
    <Card><View style={[ui.between, { flexWrap: 'wrap' }]}><Badge label={`${p.connection === 'offline' ? 'Saved · ' : ''}${humanize(match.status)}`} tone={match.status === 'in_progress' ? 'success' : 'neutral'} /><T variant="caption" color={c.muted}>{match.scheduled_at ? dateLabel(match.scheduled_at) : 'Time TBC'}</T></View>
      {[{ name: match.home_name || match.home_team_id, score: match.score.home }, { name: match.away_name || match.away_team_id, score: match.score.away }].map((team, i) => <View key={i} style={ui.row}><Avatar name={team.name} size={36} /><T variant="strong" style={ui.grow}>{team.name}</T><T variant="title" style={{ fontVariant: ['tabular-nums'] }}>{team.score ?? '—'}</T></View>)}
      <View style={ui.between}><T variant="caption" color={c.muted} style={ui.grow}>{match.venue || 'Venue to be confirmed'}</T><Icon name="next" size={18} /></View>
    </Card>
  </Pressable>;
}
// MOB-02/11: data remains external; no server requests in the screen layer.
export function FixturesScreen() {
  const p = usePreview(); const n = useNavigation<AppNavigation>(); const route = useRoute<RouteProp<TabParams, 'Fixtures'>>(); const teamId = route.params?.teamId; const [filter, setFilter] = useState('all');
  const all = p.data.fixtures.filter(x => x.league_id === p.selectedLeague?.league_id && (!teamId || x.home_team_id === teamId || x.away_team_id === teamId));
  const matches = all.filter(x => filter === 'all' || x.status === filter).sort((a,b) => (a.scheduled_at ?? 'z').localeCompare(b.scheduled_at ?? 'z') || a.match_id.localeCompare(b.match_id));
  return <Screen title="Fixtures" subtitle={p.data.tenant?.name || 'Your matchday, in one place'} stateful>
    <Select label="Competition" value={p.selectedLeague?.league_id} options={p.data.leagues.map(x => ({ value: x.league_id, label: x.name }))} onChange={p.setLeagueId} placeholder="Choose a league" />
    <ScrollView horizontal style={{flexGrow:0}} showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}><Chip label="All matches" selected={filter === 'all'} onPress={() => setFilter('all')} /><Chip label="In progress" selected={filter === 'in_progress'} onPress={() => setFilter('in_progress')} /><Chip label="Upcoming" selected={filter === 'upcoming'} onPress={() => setFilter('upcoming')} /><Chip label="Completed" selected={filter === 'completed'} onPress={() => setFilter('completed')} /></ScrollView>
    {teamId && <Button label="Show all teams" kind="quiet" onPress={() => n.navigate('Main', { screen: 'Fixtures', params: { teamId: undefined } })} />}
    <View style={{ gap: 12 }}><View style={ui.between}><T variant="section">Match schedule</T><T variant="caption" color={c.muted}>{matches.length} matches</T></View>
      {matches.length ? matches.map(x => <FixtureRow key={x.match_id} match={x} />) : <Empty title={p.selectedLeague ? 'No matches yet' : 'Your matchday starts here'} body={p.selectedLeague ? 'Matches for this competition will appear here. Try another filter or check back soon.' : 'Choose a competition when league information is available to see fixtures, scores and match details.'} action={filter !== 'all' ? 'Clear filter' : 'Refresh schedule'} onAction={() => { setFilter('all'); if (!all.length) p.notify('The schedule is ready for data. No matches are available yet.'); }} />}
    </View>{p.data.lastUpdated && <T variant="caption" color={c.muted}>Last updated {dateLabel(p.data.lastUpdated)}</T>}
  </Screen>;
}
