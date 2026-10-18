import { useNavigation,useRoute } from '@react-navigation/native';
import { useEffect,useState } from 'react';
import { useApp } from '../../app/AppContext';
import { FormProgress } from '../../components/forms/FormProgress';
import { MatchScore } from '../../components/MatchScore';
import { Button,Empty,Message,Row,Screen,Section,Select,Sheet,T } from '../../components/ui';
import type { AppNavigation } from '../../navigation/routes';
export function ScoringEntryScreen() {
  const p = useApp();
  const n = useNavigation<AppNavigation>();
  const r = useRoute();
  const requested = (r.params as {
    matchId?: string;
  } | undefined)?.matchId;
  const [step, setStep] = useState(0);
  const [id, setId] = useState(requested);
  const [team, setTeam] = useState<string>();
  const [event, setEvent] = useState<string>();
  const [control, setControl] = useState<'match_start' | 'match_end' | null>(null);
  const matches = p.data.fixtures.filter(x => p.role === 'super_admin' || p.data.user?.league_ids?.includes(x.league_id));
  const match = matches.find(x => x.match_id === id);
  const choices = match ? p.eventsFor(match.match_id) : [];
  useEffect(() => {
    if (id)
      return p.watchMatch(id);
  }, [id]);
  async function confirm(eventType: 'score' | 'match_start' | 'match_end') {
    if (!match)
      return;
    const result = await p.run({ kind: 'score', matchId: match.match_id, eventType, teamId: team, scoringEvent: event });
    if (result.ok) {
      setControl(null);
      if (result.queued)
        n.navigate('SyncStatus');
      else
        n.navigate('MatchDetail', { matchId: match.match_id });
    }
  }
  return <Screen title="Record match event" back>
    {!['super_admin', 'league_organizer'].includes(p.role) ? <Empty title="Organizer access required" body="You can score matches only in competitions you organize." icon="score" /> : <>

      <FormProgress labels={['Choose match', 'Choose event', 'Review event']} step={step} />

      {step === 0 && <>
        <Select label="Match" value={id} options={matches.map(x => ({ value: x.match_id, label: `${x.home_name || x.home_team_id} vs ${x.away_name || x.away_team_id}` }))} onChange={value => {
          setId(value);
          setTeam(undefined);
          setEvent(undefined);
        }} />
        {match ? <>
          <MatchScore match={match} />
          <Button label="Record a score event" disabled={match.status !== 'in_progress'} onPress={() => setStep(1)} />
          <Section title="Match controls">
            <Button label={match.status === 'upcoming' ? 'Start this match' : 'End this match'} kind="secondary" disabled={!['upcoming', 'in_progress'].includes(match.status)} onPress={() => setControl(match.status === 'upcoming' ? 'match_start' : 'match_end')} />
            <Button label="View timeline and corrections" kind="quiet" onPress={() => n.navigate('MatchDetail', { matchId: match.match_id })} />
            <Button label="Correct an event" kind="quiet" onPress={() => n.navigate('Compensation', { matchId: match.match_id })} />
          </Section>
        </> : <Empty title="Choose your match" body="Select a match above to record events or manage its lifecycle." icon="score" />}
      </>}

      {step === 1 && match && <Section title="What happened?">
        <T>{`${(match.home_name || match.home_team_id)} vs ${(match.away_name || match.away_team_id)}`}</T>
        <Select label="Team" value={team} options={[{ value: match.home_team_id, label: match.home_name || match.home_team_id }, { value: match.away_team_id, label: match.away_name || match.away_team_id }]} onChange={setTeam} />
        <Select label="Event" value={event} options={choices} onChange={setEvent} />
        <Button label="Review event" disabled={!team || !event} onPress={() => setStep(2)} />
      </Section>}

      {step === 2 && <Section title="Confirm the moment">
        <Row title="Match" detail={match ? `${match.home_name || match.home_team_id} vs ${match.away_name || match.away_team_id}` : undefined} />
        <Row title="Team" detail={team === match?.home_team_id ? match?.home_name || team : match?.away_name || team} />
        <Row title="Event" detail={choices.find(x => x.value === event)?.label} />
        <Message title="A permanent match record" description="Accepted events remain in the timeline. Corrections are recorded as new events." />
        <Button label="Confirm score event" onPress={() => void confirm('score')} />
      </Section>}

      {step > 0 && <Button label="Back to previous step" kind="quiet" onPress={() => setStep(step - 1)} />}

      {p.connection === 'offline' && <Message title="Offline recording" description="Your action stays pending until the server accepts it." tone="warning" />}

      <Sheet title={control === 'match_start' ? 'Start this match?' : 'End this match?'} open={!!control} onClose={() => setControl(null)}>
        <T>
          This appends a permanent lifecycle event to the match timeline.
        </T>
        <Button label={control === 'match_start' ? 'Confirm start' : 'Confirm end'} onPress={() => {
          if (control)
            void confirm(control);
        }} />
        <Button label="Cancel" kind="quiet" onPress={() => setControl(null)} />
      </Sheet>

    </>}
  </Screen>;
}
