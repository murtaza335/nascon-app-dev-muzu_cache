import { View } from 'react-native';
import { colors as c } from '../theme/tokens';
import type { Fixture } from '../types/models';
import { Avatar,Badge,dateLabel,humanize,T,ui } from './ui';
export function MatchScore({ match }: {
  match: Fixture;
}) {
  return <View style={{ backgroundColor: c.darkSurface, borderRadius: 16, padding: 20, gap: 16 }}>

    <View style={[ui.between, { flexWrap: 'wrap' }]}>

      <Badge label={humanize(match.status)} tone={match.status === 'in_progress' ? 'success' : 'neutral'} />



    </View>

    <View style={[ui.row, { alignItems: 'flex-start' }]}>

      {[{ name: match.home_name || match.home_team_id, score: match.score.home, extra: match.home_extra }, { name: match.away_name || match.away_team_id, score: match.score.away, extra: match.away_extra }].map((team, i) => <View key={i} style={{ flex: 1, minWidth: 0, alignItems: 'center', gap: 12 }}>

        <Avatar name={team.name} size={48} background={c.darkRaised} color={c.onDarkSurface} />

        <T variant="strong" color={c.onDarkSurface} style={{ textAlign: 'center' }}>

          {team.name}

        </T>

        <T variant="score" color={c.onDarkSurface} accessibilityLabel={`${team.name}, score ${team.score ?? 'unavailable'}`}>

          {team.score ?? '—'}

        </T>

        {team.extra && <T variant="caption" color={c.darkMuted} style={{ textAlign: 'center' }}>

          {team.extra}

        </T>}

      </View>)}

    </View>

    <View style={{ height: 1, backgroundColor: c.darkDivider }} />

    <T variant="caption" color={c.darkMuted} style={{ textAlign: 'center' }}>

      {dateLabel(match.scheduled_at)}

      {match.venue ? ` · ${match.venue}` : ''}

    </T>

  </View>;
}
