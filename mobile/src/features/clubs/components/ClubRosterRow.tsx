import { useNavigation } from '@react-navigation/native';
import { Badge,Row,humanize } from '../../../components/ui';
import type { AppNavigation } from '../../../navigation/routes';
import type { Player } from '../../../types/models';
export function ClubRosterRow({ player }: {
  player: Player;
}) {
  const n = useNavigation<AppNavigation>();
  return <Row title={player.name} detail={player.position} onPress={() => n.navigate('PlayerProfile', { playerId: player.player_id })} trailing={<Badge label={player.on_loan ? 'On loan' : humanize(player.role || 'Registered')} tone={player.on_loan ? 'info' : 'neutral'} />} />;
}
