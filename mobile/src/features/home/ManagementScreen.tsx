import { useNavigation } from '@react-navigation/native';
import { useApp } from '../../app/AppContext';
import { Empty, Row, Screen, Section } from '../../components/ui';
import type { AppNavigation } from '../../navigation/routes';
export function ManagementScreen(){
  const p=useApp();const n=useNavigation<AppNavigation>();const organize=['super_admin','league_organizer'].includes(p.role);const manage=['super_admin','club_manager'].includes(p.role);
  return <Screen title="Management" back>{!organize&&!manage?<Empty title="Management access required" body="This workspace is available to organizers and club managers."/>:<>
    {organize&&<Section title="Competitions"><Row title="Scoring" detail="Record match events and corrections" icon="score" onPress={()=>n.navigate('ScoringEntry')}/></Section>}
    {manage&&<Section title="Club operations"><Row title="Order fulfillment" detail="Manage orders and delivery" icon="store" onPress={()=>n.navigate('OrderManagement')}/><Row title="Roster management" detail="Players, registrations and history" icon="roster" onPress={()=>n.navigate('RosterManagement')}/></Section>}
  </>}</Screen>;
}
