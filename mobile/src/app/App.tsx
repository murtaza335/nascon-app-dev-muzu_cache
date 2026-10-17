import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { PreviewProvider, usePreview } from './PreviewContext';
import { AppNavigator } from '../navigation/AppNavigator';
import { Button, T } from '../components/ui';
import { colors as c } from '../theme/tokens';

function Feedback() {
  const p=usePreview();const insets=useSafeAreaInsets();
  if(!p.message)return null;
  return <View accessibilityLiveRegion="polite" style={{position:'absolute',bottom:Math.max(insets.bottom,16)+88,left:16,right:16,padding:16,borderRadius:12,backgroundColor:c.raised,gap:8,elevation:6}}><T>{p.message}</T>{p.canUndoCart&&<Button label="Undo cart change" kind="secondary" onPress={()=>void p.undoCart()}/>}<Button label="Dismiss" kind="quiet" onPress={()=>p.setMessage(null)} style={{alignSelf:'flex-end'}}/></View>;
}
function Content(){
  const p=usePreview();
  if(!p.ready)return <View style={{flex:1,backgroundColor:c.background,padding:24,justifyContent:'center',gap:20}}><StatusBar style={p.theme==='dark'?'light':'dark'}/><T variant="heading">NaSCon Sports</T>{p.bootError?<><T>{p.bootError}</T><Button label="Retry opening app" onPress={()=>void p.retryBoot()}/></>:<><ActivityIndicator color={c.accent}/><T>Restoring your saved workspace…</T></>}</View>;
  return <View style={{flex:1,backgroundColor:c.background}}><StatusBar style={p.theme==='dark'?'light':'dark'}/><AppNavigator/><Feedback/>{p.busy&&<View accessibilityLiveRegion="polite" pointerEvents="none" style={{position:'absolute',top:48,right:16,padding:12,borderRadius:12,backgroundColor:c.raised}}><ActivityIndicator color={c.accent} accessibilityLabel="Saving your action"/></View>}</View>;
}
export default function App() {
  return <SafeAreaProvider><PreviewProvider><Content/></PreviewProvider></SafeAreaProvider>;
}
