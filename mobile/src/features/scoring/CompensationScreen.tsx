import { RouteProp,useNavigation,useRoute } from '@react-navigation/native';
import { useEffect,useState } from 'react';
import { useApp } from '../../app/AppContext';
import { Button,Empty,Field,humanize,Message,Row,Screen,Select,Sheet,T } from '../../components/ui';
import type { AppNavigation,StackParams } from '../../navigation/routes';
import { colors as c } from '../../theme/tokens';
export function CompensationScreen() {
  const p = useApp();
  const n = useNavigation<AppNavigation>();
  const r = useRoute<RouteProp<StackParams, 'Compensation'>>();
  const match = p.data.fixtures.find(x => x.match_id === r.params?.matchId);
  const events = (match?.events || []).filter(x => !x.compensated && ['score', 'discipline', 'tiebreak_winner'].includes(x.type));
  const [id, setId] = useState(r.params?.eventId);
  const event = events.find(x => x.event_id === id);
  const [reason, setReason] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [review, setReview] = useState(false);
  const allowed = !!match && (p.role === 'super_admin' || p.role === 'league_organizer' && !!p.data.user?.league_ids?.includes(match.league_id));
  useEffect(() => {
    if (match)
      return p.watchMatch(match.match_id);
  }, [match?.match_id]);
  async function confirm() {
    if (!match || !event)
      return;
    const result = await p.run({ kind: 'score', matchId: match.match_id, eventType: 'compensation', targetId: event.event_id, reason: reason.trim() });
    if (result.ok) {
      setReview(false);
      if (result.queued)
        n.navigate('SyncStatus');
      else
        n.navigate('MatchDetail', { matchId: match.match_id });
    }
  }
  return <Screen title="Correct event" back>

    {!allowed ? <Empty title="Organizer access required" body="You can correct events only in competitions you organize." icon="score" /> : <>

      <T color={c.secondary}>

        Keep the record accurate. The original event stays visible and is marked corrected.

      </T>

      <Select label="Original event" value={id} options={events.map(x => ({ value: x.event_id, label: `${x.sequence}. ${x.label || humanize(String(x.payload.event_type || x.type))}` }))} onChange={setId} />

      {event && <Row title={event.label || humanize(String(event.payload.event_type || event.type))} detail={`Event ${event.sequence} · ${event.event_id}`} />}

      <Field label="Reason for correction" placeholder="Explain what needs to be corrected" value={reason} onChangeText={setReason} multiline numberOfLines={4} maxLength={500} error={submitted && !reason.trim() ? 'Enter a reason for the correction.' : undefined} />

      {!events.length && <Message title="No eligible events" description="Only recorded events that have not been corrected can be selected." />}

      {p.connection === 'offline' && <Message title="Offline correction" description="The original event must be saved on this device. This correction stays pending until synced." tone="warning" />}

      <Button label="Review correction" disabled={!event} onPress={() => {
        setSubmitted(true);
        if (reason.trim())
          setReview(true);
      }} />

      <Sheet title="Confirm correction?" open={review} onClose={() => setReview(false)}>

        <Row title="Original event" detail={event?.label || event?.event_id} />

        <T>

          {reason}

        </T>

        <Message title="History is preserved" description="The server appends a correction and retains the original event." />

        <Button label="Confirm correction" onPress={() => void confirm()} />

        <Button label="Keep editing" kind="quiet" onPress={() => setReview(false)} />

      </Sheet>

    </>}

  </Screen>;
}
