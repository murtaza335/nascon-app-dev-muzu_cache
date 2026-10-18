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
      <View style={{
        backgroundColor: c.darkSurface,
        padding: 22,
        borderRadius: 16,
        gap: 14,
        overflow: 'hidden',
        position: 'relative',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
        elevation: 3,
      }}>
        {/* Subtle contour overlay */}
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} pointerEvents="none">
          <View style={{ position: 'absolute', width: 200, height: 140, top: -40, right: -30, borderRadius: 80, borderWidth: 1.2, borderColor: 'rgba(255,255,255,0.06)', transform: [{ rotate: '20deg' }] }} />
        </View>

        <View style={ui.row}>
          <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: c.darkRaised, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={organizer ? 'score' : manager ? 'roster' : 'settings'} color={c.onDarkSurface} size={20} />
          </View>
          <T variant="section" color={c.onDarkSurface} style={{ fontWeight: '700' }}>
            {organizer ? 'Scoring' : manager ? 'Roster' : 'Management'}
          </T>
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
    <View style={{ gap: 10 }}>
      {[
        { title: 'League standings', detail: 'Rankings and qualification', route: 'Standings' as const, icon: 'standings' as const },
        { title: 'Match schedule', detail: 'Find your next fixture', route: 'Fixtures' as const, icon: 'fixtures' as const },
        { title: 'Club store', detail: 'Support your club', route: 'Store' as const, icon: 'store' as const }
      ].map(item => <Tap key={item.route} label={item.title} onPress={() => n.navigate('Main', { screen: item.route })}>
        <View style={[ui.row, {
          padding: 16,
          backgroundColor: c.surface,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: c.divider,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.03,
          shadowRadius: 4,
          elevation: 1,
        }]}>
          <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: c.olive, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={item.icon} color={c.accent} size={20} />
          </View>
          <View style={[ui.grow, { gap: 2 }]}>
            <T variant="strong" style={{ fontSize: 15 }}>
              {item.title}
            </T>
            <T variant="caption" color={c.secondary} style={{ fontSize: 13 }}>
              {item.detail}
            </T>
          </View>
          <Icon name="next" size={18} color={c.muted} />
        </View>
      </Tap>)}
    </View>
  </Section>;
}
