import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { NavigatorScreenParams } from '@react-navigation/native';
export type StackParams = {
  Login: undefined; Main: NavigatorScreenParams<TabParams> | undefined; Settings: undefined; MatchDetail: { matchId?: string } | undefined;
  PlayerProfile: { playerId?: string } | undefined; ProductDetail: { productId?: string } | undefined;
  Cart: undefined; Checkout: undefined; Receipt: { orderId?: string } | undefined;
  Orders: undefined; OrderDetail: { orderId?: string } | undefined;
  AddPlayer: undefined; RosterAction: { playerId?: string; action?: 'transfer' | 'loan' | 'release' } | undefined;
  Compensation: { matchId?: string; eventId?: string } | undefined;
  SyncStatus: undefined; Account: undefined; ClubProfile: { clubId?: string } | undefined;
  ScoringEntry: { matchId?: string } | undefined;
  Management: undefined;
   OrderManagement: {orderId?:string}|undefined;
  RosterManagement: { clubId?: string } | undefined;
};
export type AppNavigation = NativeStackNavigationProp<StackParams>;
export type TabParams = { Fixtures: { teamId?: string } | undefined; Standings: undefined; Store: undefined; Club: undefined; Roster: undefined; Scoring: undefined };
