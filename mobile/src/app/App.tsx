import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider,useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar,Button,LoadingOverlay,Message,ProgressBar,T,Toast } from '../components/ui';
import { AppNavigator } from '../navigation/AppNavigator';
import { colors as c } from '../theme/tokens';
import { AppProvider,useApp } from './AppContext';
function Splash() {
  const p = useApp();
  return <View style={{ flex: 1, backgroundColor: c.darkSurface, padding: 24, justifyContent: 'center', gap: 24 }}>

    <StatusBar style="light" />

    <View style={{ alignItems: 'center', gap: 16 }}>

      <Avatar name="Sportron" size={72} />

      <T variant="heading" color={c.onDarkSurface} accessibilityRole="header">

        Sportron

      </T>

    </View>

    {p.bootError ? <>

      <Message title="We couldn’t open the app" description={p.bootError} tone="error" />

      <Button label="Retry opening app" onPress={() => void p.retryBoot()} />

    </> : <View style={{ gap: 12, alignItems: 'center' }}>

      <ProgressBar active style={{ alignSelf: 'stretch', marginHorizontal: 48, borderRadius: 2 }} />

      <T color={c.darkMuted}>

        Restoring your saved workspace…

      </T>

    </View>}

  </View>;
}
function Content() {
  const p = useApp();
  const insets = useSafeAreaInsets();
  if (!p.ready)
    return <Splash />;
  return <View style={{ flex: 1, backgroundColor: c.background }}>

    <StatusBar style="light" />

    <AppNavigator />

    {/* Background work (sync, cart edits) only shows a thin bar; user-started actions get the blocking overlay. */}

    <ProgressBar active={p.busy && !p.blocking} style={{ position: 'absolute', top: insets.top, left: 0, right: 0 }} />

    <Toast message={p.message} onDismiss={() => p.setMessage(null)} action={p.canUndoCart ? 'Undo' : undefined} onAction={() => void p.undoCart()} />

    <LoadingOverlay label={p.blocking} />

  </View>;
}
export default function App() {
  return <SafeAreaProvider>

    <AppProvider>

      <Content />

    </AppProvider>

  </SafeAreaProvider>;
}
