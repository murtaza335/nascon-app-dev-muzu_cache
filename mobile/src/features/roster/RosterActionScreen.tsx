import { RouteProp,useNavigation,useRoute } from '@react-navigation/native';
import { useEffect,useState } from 'react';
import { View } from 'react-native';
import { useApp } from '../../app/AppContext';
import { FormProgress } from '../../components/forms/FormProgress';
import { Button,Chip,Empty,Field,LeaguePicker,Message,Row,Screen,Section,Select,T,humanize } from '../../components/ui';
import type { AppNavigation,StackParams } from '../../navigation/routes';
import { colors as c } from '../../theme/tokens';
function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
export function RosterActionScreen() {
  const p = useApp();
  const n = useNavigation<AppNavigation>();
  const r = useRoute<RouteProp<StackParams, 'RosterAction'>>();
  const [step, setStep] = useState(0);
  const [action, setAction] = useState<'transfer' | 'loan' | 'release'>(r.params?.action || 'transfer');
  const [id, setId] = useState(r.params?.playerId);
  const [destination, setDestination] = useState<string>();
  const [date, setDate] = useState('');
  const [end, setEnd] = useState('');
  const [reason, setReason] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const players = p.data.players.filter(x => p.role === 'super_admin' || x.club_id === p.data.user?.club_id);
  const player = players.find(x => x.player_id === id);
  const registration = p.data.registrations?.find(x => x.player_id === id && x.league_id === p.selectedLeague?.league_id);
  const squads = (p.data.squads || []).filter(x => x.league_id === p.selectedLeague?.league_id && x.squad_id !== registration?.squad_id);
  const target = squads.find(x => x.squad_id === destination);
  const from = (p.data.squads || []).find(x => x.squad_id === registration?.squad_id);
  useEffect(() => {
    if (id)
      void p.fetchHistory(id);
  }, [id]);
  function next() {
    setSubmitted(true);
    if (step === 0 && (!player || !registration?.squad_id || !p.selectedLeague))
      return;
    if (step === 2 && (!validDate(date) || !reason.trim() || action !== 'release' && !target || action === 'loan' && (!validDate(end) || end <= date)))
      return;
    setSubmitted(false);
    setStep(step + 1);
  }
  async function confirm() {
    if (!player || !p.selectedLeague)
      return;
    const result = await p.run({ kind: 'roster', playerId: player.player_id, action, leagueId: p.selectedLeague.league_id, toSquadId: target?.squad_id, effectiveDate: date, loanEndDate: action === 'loan' ? end : undefined, reason: reason.trim() });
    if (result.ok) {
      if (result.queued)
        n.navigate('SyncStatus');
      else
        n.navigate('PlayerProfile', { playerId: player.player_id });
    }
  }
  return <Screen title="Change registration" back>
    {!['super_admin', 'club_manager'].includes(p.role) ? <Empty title="Manager access required" body="Registration changes are available to authorized managers." /> : <>

      <FormProgress labels={['Choose player', 'Choose action', 'Enter details', 'Review change']} step={step} />

      {step === 0 && <Section title="Who is moving?">
        <LeaguePicker />
        <Select label="Registered player" value={id} options={players.map(x => ({ value: x.player_id, label: x.name }))} onChange={setId} />
        {player && <Row title={player.name} detail={from?.name || 'Not registered in this competition'} />}
        {submitted && !registration?.squad_id && <Message title="Choose a registered player" description="Select a player registered in this competition before continuing." tone="error" />}
      </Section>}

      {step === 1 && <Section title="What needs to change?">
        <T>{`${(player?.name)} / ${(from?.name)}`}</T>
        {(['transfer', 'loan', 'release'] as const).map(value => <View key={value} style={{ gap: 8, padding: 16, borderRadius: 12, backgroundColor: action === value ? c.olive : c.surface }}>
          <Chip label={humanize(value)} selected={action === value} onPress={() => setAction(value)} />
          <T color={c.secondary}>
            {value === 'transfer' ? 'Move the player to another squad.' : value === 'loan' ? 'Move temporarily, with a defined end date.' : 'End the current squad registration.'}
          </T>
        </View>)}
      </Section>}

      {step === 2 && <Section title={`${humanize(action)} details`}>

        {action !== 'release' && <>
          <Select label="Destination squad" value={destination} options={squads.map(x => ({ value: x.squad_id, label: x.name }))} onChange={setDestination} />
          {submitted && !target && <Message title="Choose a destination" tone="error" />}
        </>}

        <Field label="Effective date" placeholder="YYYY-MM-DD" value={date} onChangeText={setDate} error={submitted && !validDate(date) ? 'Enter a valid date as YYYY-MM-DD.' : undefined} />

        {action === 'loan' && <Field label="Loan end date" placeholder="YYYY-MM-DD" value={end} onChangeText={setEnd} error={submitted && (!validDate(end) || end <= date) ? 'Choose a valid date after the effective date.' : undefined} />}

        <Field label="Reason" placeholder="Explain this change" value={reason} onChangeText={setReason} multiline numberOfLines={3} maxLength={500} error={submitted && !reason.trim() ? 'Add a reason for the permanent history.' : undefined} />

      </Section>}

      {step === 3 && <Section title="Review before confirming">
        <Row title="Player" detail={player?.name} />
        <Row title="Action" detail={humanize(action)} />
        <Row title="From" detail={from?.name} />
        {action !== 'release' && <Row title="To" detail={target?.name} />}
        <Row title="Effective date" detail={date} />
        {action === 'loan' && <Row title="Loan ends" detail={end} />}
        <Row title="Reason" detail={reason} />
        <Message title="History is preserved" description="Some accepted changes take effect after an active match ends. Your confirmed roster updates after server acceptance." />
      </Section>}

      {p.connection === 'offline' && <Message title="This action will be pending" description="Saved player history is required. The action stays on this device until synced." tone="warning" />}

      {step < 3 ? <Button label="Continue" onPress={next} /> : <Button label={`Confirm ${action}`} kind={action === 'release' ? 'danger' : 'primary'} onPress={() => void confirm()} />}

      {step > 0 && <Button label="Back to previous step" kind="quiet" onPress={() => {
        setSubmitted(false);
        setStep(step - 1);
      }} />}

    </>}
  </Screen>;
}
