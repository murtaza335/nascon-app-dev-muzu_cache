import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import { useApp } from '../../app/AppContext';
import { FormProgress } from '../../components/forms/FormProgress';
import { Button,Empty,Field,LeaguePicker,Message,Row,Screen,Section,Select,humanize } from '../../components/ui';
import type { AppNavigation } from '../../navigation/routes';
export function AddPlayerScreen() {
  const p = useApp();
  const n = useNavigation<AppNavigation>();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [position, setPosition] = useState('');
  const [squad, setSquad] = useState<string>();
  const [role, setRole] = useState('substitute');
  const [submitted, setSubmitted] = useState(false);
  const squads = (p.data.squads || []).filter(x => (p.role === 'super_admin' || x.club_id === p.data.user?.club_id) && x.league_id === p.selectedLeague?.league_id);
  const selected = squads.find(x => x.squad_id === squad);
  function next() {
    setSubmitted(true);
    if (step === 0 && (!name.trim() || !position.trim()) || step === 1 && (!selected || !p.selectedLeague))
      return;
    setSubmitted(false);
    setStep(step + 1);
  }
  async function submit() {
    if (!selected || !p.selectedLeague)
      return;
    const result = await p.run({ kind: 'addPlayer', name: name.trim(), position: position.trim(), squadId: selected.squad_id, role, leagueId: p.selectedLeague.league_id, clubId: selected.club_id });
    if (result.ok && result.id)
      n.replace('PlayerProfile', { playerId: result.id });
  }
  return <Screen title="Add player" back>
    {!['super_admin', 'club_manager'].includes(p.role) ? <Empty title="Manager access required" body="You can add players only to a club you manage." /> : <>

      <FormProgress labels={['Player details', 'Registration', 'Review player']} step={step} />

      {step === 0 && <Section title="Introduce your player">
        <Field label="Full name" placeholder="Player's full name" value={name} onChangeText={setName} error={submitted && !name.trim() ? 'Enter a name.' : undefined} />
        <Field label="Position" placeholder="Position in the sport configuration" value={position} onChangeText={setPosition} error={submitted && !position.trim() ? 'Enter a position.' : undefined} />
      </Section>}

      {step === 1 && <Section title="Place them in the squad">
        <LeaguePicker />
        <Select label="Squad" value={squad} options={squads.map(x => ({ value: x.squad_id, label: x.name }))} onChange={setSquad} />
        <Select label="Player role" value={role} options={['captain', 'vice_captain', 'starter', 'substitute'].map(value => ({ value, label: humanize(value) }))} onChange={setRole} />
        {submitted && !selected && <Message title="Choose a competition and squad" tone="error" />}
      </Section>}

      {step === 2 && <Section title="Review registration">
        <Row title="Name" detail={name} />
        <Row title="Position" detail={position} />
        <Row title="Competition" detail={p.selectedLeague?.name} />
        <Row title="Squad" detail={selected?.name} />
        <Row title="Role" detail={humanize(role)} />
      </Section>}

      {p.connection === 'offline' && <Message title="Connect to add the player" description="A new registration cannot be queued offline." tone="warning" />}

      {step < 2 ? <Button label="Continue" onPress={next} /> : <Button label="Create player registration" disabled={p.connection === 'offline'} onPress={() => void submit()} />}

      {step > 0 && <Button label="Back to previous step" kind="quiet" onPress={() => setStep(step - 1)} />}

    </>}
  </Screen>;
}
