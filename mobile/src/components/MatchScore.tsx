import { View } from 'react-native';
import { colors as c } from '../theme/tokens';
import type { Fixture } from '../types/models';
import { Avatar,Badge,dateLabel,humanize,T,ui } from './ui';
export function MatchScore({ match }: {
  match: Fixture;
}) {
  const live = match.status === 'in_progress';
  return <View style={{
    backgroundColor: c.darkSurface,
    borderRadius: 18,
    padding: 22,
    gap: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  }}>
    {/* Subtle topographic contour overlay */}
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} pointerEvents="none">
      <View style={{ position: 'absolute', width: 260, height: 180, top: -60, right: -40, borderRadius: 100, borderWidth: 1.2, borderColor: 'rgba(255,255,255,0.06)', transform: [{ rotate: '25deg' }] }} />
      <View style={{ position: 'absolute', width: 200, height: 130, top: -30, right: -15, borderRadius: 70, borderWidth: 1.2, borderColor: 'rgba(255,255,255,0.08)', transform: [{ rotate: '20deg' }] }} />
      <View style={{ position: 'absolute', width: 220, height: 150, bottom: -50, left: -40, borderRadius: 90, borderWidth: 1.2, borderColor: 'rgba(255,255,255,0.05)', transform: [{ rotate: '-15deg' }] }} />
    </View>

    <View style={[ui.between, { flexWrap: 'wrap' }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {live && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#86EFAC' }} />}
        <Badge label={humanize(match.status)} tone={live ? 'success' : 'neutral'} />
      </View>
      <T variant="caption" color={c.darkMuted} style={{ fontSize: 13, fontWeight: '500' }}>
        {match.venue || 'Venue TBC'}
      </T>
    </View>

    <View style={[ui.row, { alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 }]}>
      {/* Home Team */}
      <View style={{ flex: 1, minWidth: 0, alignItems: 'center', gap: 8 }}>
        <Avatar name={match.home_name || match.home_team_id} size={52} background={c.darkRaised} color={c.onDarkSurface} />
        <T variant="strong" color={c.onDarkSurface} numberOfLines={2} style={{ textAlign: 'center', fontSize: 15 }}>
          {match.home_name || match.home_team_id}
        </T>
        <T variant="score" color={c.onDarkSurface} accessibilityLabel={`${match.home_name || match.home_team_id}, score ${match.score.home ?? 'unavailable'}`}>
          {match.score.home ?? '—'}
        </T>
        {match.home_extra && <T variant="caption" color={c.darkMuted} style={{ textAlign: 'center' }}>
          {match.home_extra}
        </T>}
      </View>

      {/* Center Divider / VS */}
      <View style={{ alignItems: 'center', paddingHorizontal: 12, gap: 4 }}>
        <View style={{ backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
          <T variant="label" color={c.darkMuted} style={{ fontWeight: '700', fontSize: 13 }}>
            VS
          </T>
        </View>
      </View>

      {/* Away Team */}
      <View style={{ flex: 1, minWidth: 0, alignItems: 'center', gap: 8 }}>
        <Avatar name={match.away_name || match.away_team_id} size={52} background={c.darkRaised} color={c.onDarkSurface} />
        <T variant="strong" color={c.onDarkSurface} numberOfLines={2} style={{ textAlign: 'center', fontSize: 15 }}>
          {match.away_name || match.away_team_id}
        </T>
        <T variant="score" color={c.onDarkSurface} accessibilityLabel={`${match.away_name || match.away_team_id}, score ${match.score.away ?? 'unavailable'}`}>
          {match.score.away ?? '—'}
        </T>
        {match.away_extra && <T variant="caption" color={c.darkMuted} style={{ textAlign: 'center' }}>
          {match.away_extra}
        </T>}
      </View>
    </View>

    <View style={{ height: 1, backgroundColor: c.darkDivider }} />

    <T variant="caption" color={c.darkMuted} style={{ textAlign: 'center' }}>
      {dateLabel(match.scheduled_at)}
      {match.venue ? ` · ${match.venue}` : ''}
    </T>
  </View>;
}
