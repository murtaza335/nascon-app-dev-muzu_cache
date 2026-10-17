import { useNavigation, useRoute } from '@react-navigation/native';
import { usePreview } from '../../app/PreviewContext';
import { Badge, Button, Card, Empty, humanize, Row, Screen, Section, Select, T } from '../../components/ui';
import type { AppNavigation } from '../../navigation/routes';
import { colors as c } from '../../theme/tokens';
export function RosterScreen() {
  const p=usePreview();const n=useNavigation<AppNavigation>();const route=useRoute();const requested=(route.params as {clubId?:string}|undefined)?.clubId;const club=p.data.clubs.find(x=>x.club_id===(requested||p.data.user?.club_id)) || (p.role==='super_admin'?p.data.clubs[0]:undefined);
  if(!['club_manager','super_admin'].includes(p.role))return <Screen title="Roster"><Empty title="Club management access" body="Roster actions are available to authorized club managers." icon="roster"/></Screen>;
  const roster=club?.roster || [];
  return <Screen title="Your roster" back={route.name==='RosterManagement'} subtitle={club?.name||'Build a stronger team'} stateful><Select label="Competition" value={p.selectedLeague?.league_id} options={p.data.leagues.map(x=>({value:x.league_id,label:x.name}))} onChange={p.setLeagueId}/><Button label="Add a player" icon="plus" onPress={()=>n.navigate('AddPlayer')}/><Section title="The team">{roster.length?roster.map(player=><Card key={player.player_id}><Row title={player.name} detail={player.position} icon="person" onPress={()=>n.navigate('PlayerProfile',{playerId:player.player_id})}/><Badge label={player.on_loan?'On loan':humanize(player.role||'registered')}/><Button label="Manage registration" kind="secondary" onPress={()=>n.navigate('RosterAction',{playerId:player.player_id})}/></Card>):<Empty title="Great teams start here" body="Your club’s registered players, roles and loan information will appear here." icon="roster"/>}</Section><Section title="Roster changes"><T color={c.secondary}>Transfers, loans and releases keep a visible history. Offline changes remain pending until the server accepts them.</T><Button label="View sync status" kind="quiet" onPress={()=>n.navigate('SyncStatus')}/></Section></Screen>;
}
