import { RouteProp,useNavigation,useRoute } from '@react-navigation/native';
import { useState } from 'react';
import { ScrollView,View } from 'react-native';
import { useApp } from '../../app/AppContext';
import { Button,Chip,Empty,Field,LeaguePicker,Screen,T,ui } from '../../components/ui';
import type { AppNavigation,TabParams } from '../../navigation/routes';
import { colors as c } from '../../theme/tokens';
import { MatchDateGroup } from './components/MatchCard';
import { filterFixtures,groupFixtures } from './selectors';
export { MatchCard as FixtureRow } from './components/MatchCard';
export function FixturesScreen() {
  const p = useApp();
  const n = useNavigation<AppNavigation>();
  const r = useRoute<RouteProp<TabParams, 'Fixtures'>>();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const matches = filterFixtures(p.data.fixtures.filter(x => x.league_id === p.selectedLeague?.league_id), query, status, r.params?.teamId);
  return (<Screen title="Fixtures">

    <View style={{ gap: 12 }}>

      <LeaguePicker />

      <Field label="Find a match" placeholder="Search teams or venue" value={query} onChangeText={setQuery} autoCorrect={false} />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8 }}>

        {[['all', 'All'], ['in_progress', 'Live'], ['upcoming', 'Upcoming'], ['completed', 'Results']].map(([value, label]) => <Chip key={value} label={label} selected={status === value} onPress={() => setStatus(value)} />)}

      </ScrollView>

    </View>

    {r.params?.teamId && <Button label="Clear team filter" kind="quiet" onPress={() => n.navigate('Main', { screen: 'Fixtures', params: { teamId: undefined } })} />}

    <View style={ui.between}>
      <T variant="section">
        Schedule
      </T>
      <T variant="caption" color={c.secondary}>
        {`${matches.length} matches`}
      </T>
    </View>

    {matches.length ? groupFixtures(matches).map(group => <MatchDateGroup key={group.label} {...group} />) : <Empty title={query ? 'No matching fixtures' : 'No fixtures here yet'} body={query ? 'Try another team name or venue, or clear your filters.' : 'Choose another competition or refresh its schedule.'} action="Reset filters" onAction={() => {
      setQuery('');
      setStatus('all');
    }} />}

  </Screen>);
}
