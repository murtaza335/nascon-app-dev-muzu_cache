import type { NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
export type StackParams = {
  Login: undefined;
  Main: NavigatorScreenParams<TabParams> | undefined;
  Settings: undefined;
  MatchDetail: {
    matchId?: string;
  } | undefined;
  PlayerProfile: {
    playerId?: string;
  } | undefined;
  ProductDetail: {
    productId?: string;
  } | undefined;
  Cart: undefined;
  Checkout: undefined;
  Receipt: {
    orderId?: string;
  } | undefined;
  Orders: undefined;
  OrderDetail: {
    orderId?: string;
  } | undefined;
  AddPlayer: undefined;
  RosterAction: {
    playerId?: string;
    action?: 'transfer' | 'loan' | 'release';
  } | undefined;
  Compensation: {
    matchId?: string;
    eventId?: string;
  } | undefined;
  SyncStatus: undefined;
  Account: undefined;
  ClubProfile: {
    clubId?: string;
  } | undefined;
  ScoringEntry: {
    matchId?: string;
  } | undefined;
  Management: undefined;
  OrderManagement: {
    orderId?: string;
  } | undefined;
  RosterManagement: {
    clubId?: string;
  } | undefined;
  EntityRoute: { entityId: string };
  MatchLive: { matchId: string };
  CoStreamView: { sessionId: string; publishUrl?: string };
  CoStreamControl: { sessionId: string };
  GoLive: undefined;
  QRScanner: undefined;
  Notifications: undefined;
  CoStreamEntry: { inviteToken?: string } | undefined;
};
export type AppNavigation = NativeStackNavigationProp<StackParams>;
export type TabParams = {
  Home: undefined;
  Fixtures: {
    teamId?: string;
  } | undefined;
  Standings: undefined;
  Store: undefined;
  Club: undefined;
};
