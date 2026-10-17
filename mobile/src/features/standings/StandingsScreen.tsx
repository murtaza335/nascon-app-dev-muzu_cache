import { Pressable, ScrollView, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../../app/AppContext';
import { Badge, Empty, humanize, Screen, Select, T, ui } from '../../components/ui';
import type { AppNavigation } from '../../navigation/routes';
import { colors as c } from '../../theme/tokens';

export function StandingsScreen() {
  const p = useApp(); const n = useNavigation<AppNavigation>();
  const rows = p.data.standings[p.selectedLeague?.league_id || ''] || [];
  return <Screen title="Standings" stateful skeleton="table">
    <Select label="Competition" value={p.selectedLeague?.league_id} options={p.data.leagues.map(x => ({ value: x.league_id, label: x.name }))} onChange={p.setLeagueId} placeholder="Choose a league" />
    {rows.length ? <><ScrollView horizontal style={{flexGrow:0}} showsHorizontalScrollIndicator contentContainerStyle={{ minWidth: '100%' }}><View style={{ minWidth: 510 }}><View style={[ui.row, { paddingVertical: 12, borderBottomWidth: 1, borderColor: c.outline }]}><T variant="label" style={{ width: 28 }}>#</T><T variant="label" style={{ flex: 1 }}>Team</T>{['P','W','D','L','Pts'].map(x => <T key={x} accessibilityLabel={{ P:'Played', W:'Won', D:'Drawn', L:'Lost', Pts:'Points' }[x]} variant="label" color={c.secondary} style={{ width: 34, textAlign: 'center' }}>{x}</T>)}</View>
      {rows.map(row => <Pressable key={row.team_id} accessibilityRole="button" accessibilityLabel={`${row.name || row.team_id}, rank ${row.rank}, ${row.points} points, ${humanize(row.status)}. Open team fixtures`} onPress={() => n.navigate('Main', { screen: 'Fixtures', params: { teamId: row.team_id } })} style={[ui.row, { paddingVertical: 18, borderBottomWidth: 1, borderColor: c.divider }]}><T variant="strong" color={row.rank === 1 ? c.accent : c.secondary} style={{ width: 28 }}>{row.rank}</T><View style={{ flex: 1, gap: 8 }}><T variant="strong">{row.name || row.team_id}</T><Badge label={humanize(row.status)} tone={row.status === 'clinched' ? 'success' : row.status === 'eliminated' ? 'neutral' : 'info'} />{!!row.resolved_by && <T variant="caption" color={c.muted}>Tie-break: {humanize(row.resolved_by)}</T>}</View>{[row.played,row.won,row.drawn,row.lost,row.points].map((value,i) => <T key={i} variant={i === 4 ? 'strong' : 'body'} style={{ width: 34, textAlign: 'center', fontVariant: ['tabular-nums'] }}>{value}</T>)}</Pressable>)}
    </View></ScrollView><T variant="caption" color={c.muted}>Scroll across for the full table. Select a team to find its matches.</T></> : <Empty title="The table is taking shape" body="Choose a competition to see team rankings, points and qualification status when standings are available." action="Refresh standings" onAction={() => void p.refresh()} icon="standings" />}
  </Screen>;
}
