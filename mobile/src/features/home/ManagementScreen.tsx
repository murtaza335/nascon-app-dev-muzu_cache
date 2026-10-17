import { useNavigation } from '@react-navigation/native';
import { usePreview } from '../../app/PreviewContext';
import { Empty, Message, Row, Screen, Section } from '../../components/ui';
import type { AppNavigation } from '../../navigation/routes';
export function ManagementScreen(){
  const p=usePreview();const n=useNavigation<AppNavigation>();const organize=['super_admin','league_organizer'].includes(p.role);const manage=['super_admin','club_manager'].includes(p.role);
  return <Screen title="Management" back>{!organize&&!manage?<Empty title="Management access required" body="This workspace is available to organizers, club managers and the platform admin."/>:<>
    <Message title="Local mock workspace" description="Management changes affect this device’s mock data. Unspecified production management APIs remain separate integration work."/>
    {organize&&<Section title="Competitions"><Row title="Create a competition" detail="Name, sport and format" icon="plus" onPress={()=>n.navigate('CompetitionSetup')}/><Row title="Seasons, divisions and stages" detail="Build the competition structure" icon="fixtures" onPress={()=>n.navigate('CompetitionStructure')}/><Row title="Generate fixtures" detail="Choose teams and review the opening schedule" icon="fixtures" onPress={()=>n.navigate('FixtureGeneration')}/><Row title="Match management" detail="Status, rescheduling and conflicts" icon="clock" onPress={()=>n.navigate('MatchManagement')}/></Section>}
    {manage&&<Section title="Club operations"><Row title="Catalogue and variants" detail="Products, stock and scheduled prices" icon="store" onPress={()=>n.navigate('CatalogueManagement')}/><Row title="Order fulfillment" detail="Packing, shipping, cancellation and refunds" icon="store" onPress={()=>n.navigate('OrderManagement')}/><Row title="Roster management" detail="Registrations, roles and history" icon="roster" onPress={()=>n.navigate('RosterManagement')}/></Section>}
    {p.role==='super_admin'&&<Section title="Platform context"><Row title="Organization branding" detail="Name and identity colors in the selected tenant" icon="person" onPress={()=>n.navigate('TenantManagement')}/><Row title="Scoring configuration" detail="Add configured scoring events" icon="score" onPress={()=>n.navigate('SportConfiguration')}/></Section>}
  </>}</Screen>;
}
