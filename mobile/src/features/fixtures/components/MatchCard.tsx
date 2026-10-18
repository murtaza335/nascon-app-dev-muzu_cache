import { useNavigation } from '@react-navigation/native';
import { View } from 'react-native';
import { useApp } from '../../../app/AppContext';
import { Icon } from '../../../components/Icon';
import { Avatar,Badge,humanize,T,Tap,ui } from '../../../components/ui';
import type { AppNavigation } from '../../../navigation/routes';
import { colors as c } from '../../../theme/tokens';
import type { Fixture } from '../../../types/models';
export function MatchCard({ match, featured = false }: {
  match: Fixture;
  featured?: boolean;
}) {
  const n = useNavigation<AppNavigation>();
  const p = useApp();
  const saved = p.connection === 'offline' || !!p.resourceError;
  const live = match.status === 'in_progress';
  return (<Tap label={`${match.home_name || match.home_team_id} versus ${match.away_name || match.away_team_id}. ${humanize(match.status)}. Open match`} onPress={() => n.navigate('MatchDetail', { matchId: match.match_id })}>

    <View style={{
      backgroundColor: featured ? c.darkSurface : c.surface,
      borderRadius: 16,
      padding: featured ? 22 : 16,
      gap: 12,
      borderWidth: 1,
      borderColor: featured ? 'rgba(255,255,255,0.1)' : c.divider,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: featured ? 0.2 : 0.04,
      shadowRadius: 6,
      elevation: 2,
      overflow: 'hidden',
      position: 'relative',
    }}>
      {featured && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} pointerEvents="none">
          <View style={{ position: 'absolute', width: 200, height: 140, top: -40, right: -30, borderRadius: 80, borderWidth: 1.2, borderColor: 'rgba(255,255,255,0.06)', transform: [{ rotate: '20deg' }] }} />
          <View style={{ position: 'absolute', width: 160, height: 110, top: -20, right: -10, borderRadius: 60, borderWidth: 1.2, borderColor: 'rgba(255,255,255,0.08)', transform: [{ rotate: '15deg' }] }} />
        </View>
      )}

      <View style={ui.between}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {live && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#86EFAC' }} />}
          <Badge label={`${saved ? 'Saved / ' : ''}${humanize(match.status)}`} tone={live ? 'success' : 'neutral'} />
        </View>

        <T variant="caption" color={featured ? c.darkMuted : c.secondary} style={{ fontWeight: '500' }}>
          {match.scheduled_at ? new Date(match.scheduled_at).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' }) : 'Time TBC'}
        </T>

      </View>

      {[{ name: match.home_name || match.home_team_id, score: match.score.home }, { name: match.away_name || match.away_team_id, score: match.score.away }].map((team, i) => (<View key={i} style={ui.row}>

        <Avatar name={team.name} size={34} background={featured ? c.darkRaised : c.olive} color={featured ? c.onDarkSurface : c.accent} />

        <T variant="strong" color={featured ? c.onDarkSurface : c.text} style={ui.grow}>
          {team.name}
        </T>

        <T variant={featured ? 'heading' : 'title'} color={featured ? c.onDarkSurface : c.text} style={{ fontVariant: ['tabular-nums'] }}>
          {team.score ?? '-'}
        </T>

      </View>))}

      <View style={[ui.between, { paddingTop: 8, borderTopWidth: 1, borderColor: featured ? c.darkDivider : c.divider }]}>

        <T variant="caption" color={featured ? c.darkMuted : c.secondary} style={ui.grow}>
          {match.venue || 'Venue to be confirmed'}
        </T>
        <Icon name="next" size={16} color={featured ? c.onDarkSurface : c.secondary} />

      </View>

    </View>

  </Tap>);
}
export function MatchDateGroup({ label, matches }: {
  label: string;
  matches: Fixture[];
}) {
  return <View style={{ gap: 12 }}>
    <T variant="strong" color={c.secondary}>
      {label}
    </T>
    {matches.map(match => <MatchCard key={match.match_id} match={match} />)}
  </View>;
}
