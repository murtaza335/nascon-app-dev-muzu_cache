import { useNavigation } from '@react-navigation/native';
import { useApp } from '../../app/AppContext';
import { Empty,Row,Screen,Section } from '../../components/ui';
import type { AppNavigation } from '../../navigation/routes';
export function ManagementScreen() {
  const p = useApp();
  const n = useNavigation<AppNavigation>();
  const organize = ['super_admin', 'league_organizer'].includes(p.role);
  const manage = ['super_admin', 'club_manager'].includes(p.role);
  return <Screen title="Management" back>

    {!organize && !manage ? <Empty title="Management access required" body="This workspace is available to authorized organizers and managers." /> : <>

      {organize && <Section title="Competition">

        <Row title="Match scoring" detail="Record events and corrections" icon="score" onPress={() => n.navigate('ScoringEntry')} />

      </Section>}

      {manage && <Section title="Club operations">

        <Row title="Player roster" detail="Registrations, transfers, loans and releases" icon="roster" onPress={() => n.navigate('RosterManagement')} />

        <Row title="Order fulfillment" detail="Packing, delivery and authorized refunds" icon="store" onPress={() => n.navigate('OrderManagement')} />

      </Section>}

    </>}

  </Screen>;
}
