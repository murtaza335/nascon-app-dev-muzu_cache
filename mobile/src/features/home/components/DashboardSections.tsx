import { useNavigation } from '@react-navigation/native';
import { View } from 'react-native';
import { useApp } from '../../../app/AppContext';
import { Icon } from '../../../components/Icon';
import { Button,Row,Section,T,Tap,ui } from '../../../components/ui';
import type { AppNavigation } from '../../../navigation/routes';
import { colors as c } from '../../../theme/tokens';
export function WorkSection() {
  const p = useApp();
  const n = useNavigation<AppNavigation>();
  const organizer = p.role === 'league_organizer';
  const manager = p.role === 'club_manager';
  const admin = p.role === 'super_admin';
  if (!organizer && !manager && !admin)
    return null;
  return (
    <View style={{ gap: 12 }}>
      <View style={{ backgroundColor: c.darkSurface, padding: 20, borderRadius: 16, gap: 12 }}>
        <View style={ui.row}>
          <Icon name={organizer ? 'score' : manager ? 'roster' : 'settings'} color={c.onDarkSurface} />
          <T variant="section" color={c.onDarkSurface}>{organizer ? 'Scoring' : manager ? 'Roster' : 'Management'}</T>
        </View>
        <Button label={organizer ? 'Open scoring' : manager ? 'Manage roster' : 'Open management'}
          kind="secondary" onDark disabled={admin && !p.session?.tenantId}
          onPress={() => n.navigate(organizer ? 'ScoringEntry' : manager ? 'RosterManagement' : 'Management')} />
        {admin && !p.session?.tenantId && <T variant="caption" color={c.darkMuted}>Select an organization first.</T>}
      </View>
      {manager && <Row title="Order fulfillment" icon="store" onPress={() => n.navigate('OrderManagement')} />}
    </View>
  );
}
export function ExploreSection() {
  const n = useNavigation<AppNavigation>();
  return <Section title="Explore">
    <View style={{ gap: 8 }}>
      {[
        { title: 'League standings', detail: 'Rankings and qualification', route: 'Standings' as const, icon: 'standings' as const },
        { title: 'Match schedule', detail: 'Find your next fixture', route: 'Fixtures' as const, icon: 'fixtures' as const },
        { title: 'Club store', detail: 'Support your club', route: 'Store' as const, icon: 'store' as const }
      ].map(item => <Tap key={item.route} label={item.title} onPress={() => n.navigate('Main', { screen: item.route })}>
        <View style={[ui.row, { padding: 16, backgroundColor: c.surface, borderRadius: 12 }]}>
          <Icon name={item.icon} color={c.accent} />
          <View style={ui.grow}>
            <T variant="strong">
              {item.title}
            </T>

          </View>
          <Icon name="next" size={18} />
        </View>
      </Tap>)}
    </View>
  </Section>;
}
