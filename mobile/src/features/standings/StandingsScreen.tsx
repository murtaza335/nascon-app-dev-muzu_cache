import { View } from 'react-native';
import { useApp } from '../../app/AppContext';
import { Empty,LeaguePicker,Screen,Section } from '../../components/ui';
import { LeadingTeams,StandingRow } from './components/StandingRow';
export function StandingsScreen() {
  const p = useApp();
  const rows = p.data.standings[p.selectedLeague?.league_id || ''] || [];
  return <Screen title="Standings" skeleton="table">
    <LeaguePicker />
    {rows.length ? <>
      <Section title="Leaders">
        <LeadingTeams rows={rows} />
      </Section>
      <Section title="League table">

        <View>
          {rows.map(row => <StandingRow key={row.team_id} row={row} />)}
        </View>
      </Section>
    </> : <Empty title="No standings yet" body="Rankings and qualification appear when your competition has results." action="Refresh standings" onAction={() => void p.refresh()} icon="standings" />}
  </Screen>;
}
