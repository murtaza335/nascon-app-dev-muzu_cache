import { SportConfigurationScreen } from '../features/settings/SportConfigurationScreen';
import { TenantManagementScreen } from '../features/settings/TenantManagementScreen';
import { OrderManagementScreen } from '../features/store/OrderManagementScreen';
import { PriceScheduleScreen } from '../features/store/PriceScheduleScreen';
import { CatalogueManagementScreen } from '../features/store/CatalogueManagementScreen';
import { MatchManagementScreen } from '../features/matches/MatchManagementScreen';
import { FixtureGenerationScreen } from '../features/fixtures/FixtureGenerationScreen';
import { CompetitionStructureScreen } from '../features/fixtures/CompetitionStructureScreen';
import { CompetitionSetupScreen } from '../features/fixtures/CompetitionSetupScreen';
import { ManagementScreen } from '../features/home/ManagementScreen';
import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePreview } from '../app/PreviewContext';
import { Icon, IconName } from '../components/Icon';
import { T } from '../components/ui';
import { colors as c } from '../theme/tokens';
import type { StackParams, TabParams } from './routes';
import { tabsForRole } from './screenRegistry';
import { LoginScreen } from '../features/auth/LoginScreen';
import { SettingsScreen } from '../features/settings/SettingsScreen';
import { FixturesScreen } from '../features/fixtures/FixturesScreen';
import { StandingsScreen } from '../features/standings/StandingsScreen';
import { MatchDetailScreen } from '../features/matches/MatchDetailScreen';
import { ClubProfileScreen } from '../features/clubs/ClubProfileScreen';
import { PlayerProfileScreen } from '../features/clubs/PlayerProfileScreen';
import { AccountScreen } from '../features/home/AccountScreen';
import { StoreScreen } from '../features/store/StoreScreen';
import { ProductDetailScreen } from '../features/store/ProductDetailScreen';
import { CartScreen } from '../features/store/CartScreen';
import { CheckoutScreen } from '../features/store/CheckoutScreen';
import { OrdersScreen } from '../features/store/OrdersScreen';
import { OrderDetailScreen } from '../features/store/OrderDetailScreen';
import { ReceiptScreen } from '../features/store/ReceiptScreen';
import { RosterScreen } from '../features/roster/RosterScreen';
import { AddPlayerScreen } from '../features/roster/AddPlayerScreen';
import { RosterActionScreen } from '../features/roster/RosterActionScreen';
import { ScoringEntryScreen } from '../features/scoring/ScoringEntryScreen';
import { CompensationScreen } from '../features/scoring/CompensationScreen';
import { SyncStatusScreen } from '../features/sync/SyncStatusScreen';
const Stack=createNativeStackNavigator<StackParams>();const Tabs=createBottomTabNavigator<TabParams>();
const icons:Record<keyof TabParams,IconName>={Fixtures:'fixtures',Standings:'standings',Store:'store',Club:'person',Roster:'roster',Scoring:'score'};
function MainTabs() {
  const p=usePreview();const {fontScale}=useWindowDimensions();const insets=useSafeAreaInsets();const available=tabsForRole(p.role);
  return <Tabs.Navigator initialRouteName="Fixtures" backBehavior="history" screenOptions={({route})=>({headerShown:false,sceneStyle:{backgroundColor:c.background},tabBarStyle:{backgroundColor:c.surface,borderTopColor:c.divider,height:80+Math.max(0,fontScale-1)*44+insets.bottom,paddingTop:8,paddingBottom:Math.max(8,insets.bottom)},tabBarLabel:({focused})=><T variant="label" color={focused?c.accent:c.muted} style={{textAlign:'center',paddingTop:4}}>{route.name==='Club'?'Club':route.name}</T>,tabBarIcon:({focused})=><View style={{backgroundColor:focused?c.olive:'transparent',width:52,height:30,borderRadius:16,alignItems:'center',justifyContent:'center'}}><Icon name={icons[route.name]} color={focused?c.accent:c.muted}/></View>,tabBarAccessibilityLabel:route.name==='Club'?'Club and profile':route.name})}>
    <Tabs.Screen name="Fixtures" component={FixturesScreen}/><Tabs.Screen name="Standings" component={StandingsScreen}/><Tabs.Screen name="Store" component={StoreScreen}/><Tabs.Screen name="Club" component={ClubProfileScreen}/>{available.includes('Roster')&&<Tabs.Screen name="Roster" component={RosterScreen}/>}
    {available.includes('Scoring')&&<Tabs.Screen name="Scoring" component={ScoringEntryScreen}/>}
  </Tabs.Navigator>;
}
export function AppNavigator() {
  const p=usePreview();const base=p.theme==='dark'?DarkTheme:DefaultTheme;
  return <NavigationContainer key={p.session?`${p.session.userId}:${p.session.tenantId}:${p.serverUrl}`:'signed-out'} theme={{...base,colors:{...base.colors,primary:c.accent,background:c.background,card:c.surface,text:c.text,border:c.divider,notification:c.accent}}}><Stack.Navigator initialRouteName={p.session?'Main':'Login'} screenOptions={{headerShown:false,contentStyle:{backgroundColor:c.background},animation:'none'}}>
    <Stack.Screen name="Settings" component={SettingsScreen}/>{!p.session?<Stack.Screen name="Login" component={LoginScreen}/>:<><Stack.Screen name="Main" component={MainTabs}/><Stack.Screen name="MatchDetail" component={MatchDetailScreen}/><Stack.Screen name="ClubProfile" component={ClubProfileScreen}/><Stack.Screen name="PlayerProfile" component={PlayerProfileScreen}/><Stack.Screen name="Account" component={AccountScreen}/><Stack.Screen name="ProductDetail" component={ProductDetailScreen}/><Stack.Screen name="Cart" component={CartScreen}/><Stack.Screen name="Checkout" component={CheckoutScreen}/><Stack.Screen name="Orders" component={OrdersScreen}/><Stack.Screen name="OrderDetail" component={OrderDetailScreen}/><Stack.Screen name="Receipt" component={ReceiptScreen}/><Stack.Screen name="AddPlayer" component={AddPlayerScreen}/><Stack.Screen name="RosterAction" component={RosterActionScreen}/><Stack.Screen name="RosterManagement" component={RosterScreen}/><Stack.Screen name="ScoringEntry" component={ScoringEntryScreen}/><Stack.Screen name="Compensation" component={CompensationScreen}/><Stack.Screen name="SyncStatus" component={SyncStatusScreen}/><Stack.Screen name="Management" component={ManagementScreen}/><Stack.Screen name="CompetitionSetup" component={CompetitionSetupScreen}/><Stack.Screen name="CompetitionStructure" component={CompetitionStructureScreen}/><Stack.Screen name="FixtureGeneration" component={FixtureGenerationScreen}/><Stack.Screen name="MatchManagement" component={MatchManagementScreen}/><Stack.Screen name="CatalogueManagement" component={CatalogueManagementScreen}/><Stack.Screen name="PriceSchedule" component={PriceScheduleScreen}/><Stack.Screen name="OrderManagement" component={OrderManagementScreen}/><Stack.Screen name="TenantManagement" component={TenantManagementScreen}/><Stack.Screen name="SportConfiguration" component={SportConfigurationScreen}/></>}
  </Stack.Navigator></NavigationContainer>;
}
