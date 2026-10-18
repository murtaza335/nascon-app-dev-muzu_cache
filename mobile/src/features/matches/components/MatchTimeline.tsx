import { useNavigation } from '@react-navigation/native';
import { View } from 'react-native';
import { Badge,Button,Empty,T,humanize,ui } from '../../../components/ui';
import type { AppNavigation } from '../../../navigation/routes';
import { colors as c } from '../../../theme/tokens';
import type { Fixture } from '../../../types/models';
export function MatchTimeline({ match, editable = false }: {
  match: Fixture;
  editable?: boolean;
}) {
  const n = useNavigation<AppNavigation>();
  return match.events?.length ? <View style={{ gap: 0 }}>
    {[...match.events].sort((a, b) => a.sequence - b.sequence).map(event => <View key={event.event_id} style={{ paddingVertical: 16, borderBottomWidth: 1, borderColor: c.divider, gap: 8 }}>
      <View style={ui.between}>
        <T variant="caption" color={c.secondary}>{`Event ${(event.sequence)}`}</T>
        {event.compensated && <Badge label="Corrected" tone="info" />}
      </View>
      <T variant="strong" style={event.compensated ? { textDecorationLine: 'line-through', color: c.secondary } : undefined}>
        {event.label || humanize(String(event.payload.event_type || event.type))}
      </T>
      {typeof event.payload.reason === 'string' && <T color={c.secondary}>
        {event.payload.reason}
      </T>}
      {editable && !event.compensated && ['score', 'discipline', 'tiebreak_winner'].includes(event.type) && <Button label="Correct this event" kind="quiet" style={{ alignSelf: 'flex-start' }} onPress={() => n.navigate('Compensation', { matchId: match.match_id, eventId: event.event_id })} />}
    </View>)}
  </View> : <Empty title="Waiting for the first event" body="Every recorded moment and its corrections will appear here." icon="clock" />;
}
