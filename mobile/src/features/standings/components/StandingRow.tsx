import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import { View } from 'react-native';
import { Badge,Button,T,humanize,ui } from '../../../components/ui';
import type { AppNavigation } from '../../../navigation/routes';
import { colors as c } from '../../../theme/tokens';
import type { Standing } from '../../../types/models';
export function StandingRow({ row }: {
  row: Standing;
}) {
  const [expanded, setExpanded] = useState(false);
  const n = useNavigation<AppNavigation>();
  return <View style={{ borderBottomWidth: 1, borderColor: c.divider, paddingVertical: 16, gap: 12 }}>

    <View style={ui.row}>
      <T variant="strong" style={{ width: 22 }}>
        {row.rank}
      </T>
      <View style={[ui.grow, { gap: 6 }]}>
        <T variant="strong">
          {row.name || row.team_id}
        </T>
        <Badge label={humanize(row.status)} tone={row.status === 'clinched' ? 'success' : row.status === 'eliminated' ? 'neutral' : 'info'} />
      </View>
      <View style={{ alignItems: 'center', gap: 2 }}>
        <T variant="strong">
          {row.played}
        </T>
        <T variant="caption" color={c.secondary}>
          Pld
        </T>
      </View>
      <View style={{ alignItems: 'flex-end', minWidth: 42 }}>
        <T variant="title" color={c.accent}>
          {row.points}
        </T>
        <T variant="caption" color={c.secondary}>
          Pts
        </T>
      </View>
    </View>

    {expanded && <View style={{ backgroundColor: c.raised, padding: 16, borderRadius: 12, gap: 12 }}>
      <View style={ui.between}>
        {[['Won', row.won], ['Drawn', row.drawn], ['Lost', row.lost]].map(([label, value]) => <View key={label} style={{ gap: 4 }}>
          <T variant="strong">
            {value}
          </T>
          <T variant="caption" color={c.secondary}>
            {label}
          </T>
        </View>)}
      </View>
      {row.resolved_by && <T variant="caption" color={c.secondary}>{`Tie-break: ${(humanize(row.resolved_by))}`}</T>}
      <Button label="Open team fixtures" kind="secondary" onPress={() => n.navigate('Main', { screen: 'Fixtures', params: { teamId: row.team_id } })} />
    </View>}

    <Button label={expanded ? 'Hide statistics' : 'Statistics and team fixtures'} kind="quiet" onPress={() => setExpanded(!expanded)} style={{ minHeight: 48, alignSelf: 'flex-start', paddingHorizontal: 0 }} />

  </View>;
}
export function LeadingTeams({ rows }: {
  rows: Standing[];
}) {
  return <View style={{ flexDirection: 'row', gap: 8 }}>
    {rows.slice(0, 3).map(row => <View key={row.team_id} style={{ flex: 1, minWidth: 0, backgroundColor: row.rank === 1 ? c.olive : c.surface, padding: 12, borderRadius: 12, gap: 8 }}>
      <T variant="caption" color={c.secondary}>{`#${(row.rank)}`}</T>
      <T variant="strong">
        {row.name || row.team_id}
      </T>
      <T variant="title" color={c.accent}>
        {row.points}
      </T>
      <T variant="caption" color={c.secondary}>
        points
      </T>
    </View>)}
  </View>;
}
