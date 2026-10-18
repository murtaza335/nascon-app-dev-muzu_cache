import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { DarkTheme,DefaultTheme,NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useWindowDimensions,View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../app/AppContext';
import { Icon,IconName } from '../components/Icon';
import { T } from '../components/ui';
import { LoginScreen } from '../features/auth/LoginScreen';
import { ClubProfileScreen } from '../features/clubs/ClubProfileScreen';
import { PlayerProfileScreen } from '../features/clubs/PlayerProfileScreen';
import { FixturesScreen } from '../features/fixtures/FixturesScreen';
import { AccountScreen } from '../features/home/AccountScreen';
import { HomeScreen } from '../features/home/HomeScreen';
import { ManagementScreen } from '../features/home/ManagementScreen';
import { MatchDetailScreen } from '../features/matches/MatchDetailScreen';
import { AddPlayerScreen } from '../features/roster/AddPlayerScreen';
import { RosterActionScreen } from '../features/roster/RosterActionScreen';
import { RosterScreen } from '../features/roster/RosterScreen';
import { CompensationScreen } from '../features/scoring/CompensationScreen';
import { ScoringEntryScreen } from '../features/scoring/ScoringEntryScreen';
import { SettingsScreen } from '../features/settings/SettingsScreen';
import { StandingsScreen } from '../features/standings/StandingsScreen';
import { CartScreen } from '../features/store/CartScreen';
import { CheckoutScreen } from '../features/store/CheckoutScreen';
import { OrderDetailScreen } from '../features/store/OrderDetailScreen';
import { OrderManagementScreen } from '../features/store/OrderManagementScreen';
import { OrdersScreen } from '../features/store/OrdersScreen';
import { ProductDetailScreen } from '../features/store/ProductDetailScreen';
import { ReceiptScreen } from '../features/store/ReceiptScreen';
import { StoreScreen } from '../features/store/StoreScreen';
import { SyncStatusScreen } from '../features/sync/SyncStatusScreen';
import { AthleteProfileScreen, CoStreamControlScreen, CoStreamEntryScreen, CoStreamScreen, EntityRouteScreen, GoLiveScreen, MatchLiveScreen, NotificationsScreen, QRScannerScreen } from '../features/day2/Day2Screens';
import { colors as c } from '../theme/tokens';
import type { StackParams,TabParams } from './routes';
const Stack = createNativeStackNavigator<StackParams>();
const Tabs = createBottomTabNavigator<TabParams>();
const icons: Record<keyof TabParams, IconName> = { Home: 'home', Fixtures: 'fixtures', Standings: 'standings', Store: 'store', Club: 'person' };
function MainTabs() {
  const { fontScale, width, height } = useWindowDimensions();
  const compactLabels = width < 420 && fontScale > 1.15;
  const shortLandscape = width > height && height < 500;
  const insets = useSafeAreaInsets();
  return <Tabs.Navigator initialRouteName="Home" backBehavior="history" screenOptions={({ route }) => ({
    headerShown: false,
    sceneStyle: { backgroundColor: c.background },
    tabBarStyle: {
      backgroundColor: c.surface,
      borderTopColor: c.divider,
      borderTopWidth: 1,
      height: (shortLandscape ? 64 : 72 + Math.max(0, fontScale - 1) * 70) + insets.bottom,
      paddingTop: 8,
      paddingBottom: Math.max(8, insets.bottom),
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.04,
      shadowRadius: 6,
      elevation: 6,
    },
    tabBarLabel: ({ focused }) => <T variant="label" numberOfLines={1} color={focused ? c.accent : c.muted} style={{ textAlign: 'center', paddingTop: shortLandscape ? 0 : 3, fontWeight: focused ? '700' : '500', fontSize: 12 }}>
      {compactLabels && route.name === 'Fixtures' ? 'Games' : compactLabels && route.name === 'Standings' ? 'Table' : route.name}
    </T>,
    tabBarIcon: ({ focused }) => <View style={{ backgroundColor: focused ? c.olive : 'transparent', width: 52, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={icons[route.name]} color={focused ? c.accent : c.muted} size={22} />
    </View>,
    tabBarAccessibilityLabel: route.name === 'Club' ? 'Club and profile' : route.name
  })}>

    <Tabs.Screen name="Home" component={HomeScreen} />

    <Tabs.Screen name="Fixtures" component={FixturesScreen} />

    <Tabs.Screen name="Standings" component={StandingsScreen} />

    <Tabs.Screen name="Store" component={StoreScreen} />

    <Tabs.Screen name="Club" component={ClubProfileScreen} />

  </Tabs.Navigator>;
}
export function AppNavigator() {
  const p = useApp();
  const base = p.theme === 'dark' ? DarkTheme : DefaultTheme;
  return <NavigationContainer key={p.session ? `${p.session.userId}:${p.session.tenantId}:${p.serverUrl}` : 'signed-out'} linking={{ prefixes: ['nascon://'], config: { screens: { EntityRoute: 'entity/:entityId', CoStreamView: 'stream/:sessionId' } } }} theme={{ ...base, colors: { ...base.colors, primary: c.accent, background: c.background, card: c.surface, text: c.text, border: c.divider, notification: c.accent } }}>

    <Stack.Navigator initialRouteName={p.session ? 'Main' : 'Login'} screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.background }, animation: 'none' }}>

      <Stack.Screen name="Settings" component={SettingsScreen} />

      {/* Public Day 2 routes stay registered before and after member authentication. */}
      <Stack.Screen name="EntityRoute" component={EntityRouteScreen} />
      <Stack.Screen name="MatchLive" component={MatchLiveScreen} />
      <Stack.Screen name="CoStreamView" component={CoStreamScreen} />
      <Stack.Screen name="QRScanner" component={QRScannerScreen} />
      <Stack.Screen name="GoLive" component={GoLiveScreen} />
      <Stack.Screen name="CoStreamEntry" component={CoStreamEntryScreen} />

      {!p.session ? <Stack.Screen name="Login" component={LoginScreen} /> : <>

        <Stack.Screen name="Main" component={MainTabs} />

        <Stack.Screen name="MatchDetail" component={MatchDetailScreen} />

        <Stack.Screen name="CoStreamControl" component={CoStreamControlScreen} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} />

        <Stack.Screen name="ClubProfile" component={ClubProfileScreen} />

        <Stack.Screen name="PlayerProfile" component={PlayerProfileScreen} />

        <Stack.Screen name="Account" component={AccountScreen} />

        <Stack.Screen name="ProductDetail" component={ProductDetailScreen} />

        <Stack.Screen name="Cart" component={CartScreen} />

        <Stack.Screen name="Checkout" component={CheckoutScreen} />

        <Stack.Screen name="Orders" component={OrdersScreen} />

        <Stack.Screen name="OrderDetail" component={OrderDetailScreen} />

        <Stack.Screen name="Receipt" component={ReceiptScreen} />

        <Stack.Screen name="AddPlayer" component={AddPlayerScreen} />

        <Stack.Screen name="RosterAction" component={RosterActionScreen} />

        <Stack.Screen name="RosterManagement" component={RosterScreen} />

        <Stack.Screen name="ScoringEntry" component={ScoringEntryScreen} />

        <Stack.Screen name="Compensation" component={CompensationScreen} />

        <Stack.Screen name="SyncStatus" component={SyncStatusScreen} />

        <Stack.Screen name="Management" component={ManagementScreen} />

        <Stack.Screen name="OrderManagement" component={OrderManagementScreen} />

      </>}

    </Stack.Navigator>

  </NavigationContainer>;
}
