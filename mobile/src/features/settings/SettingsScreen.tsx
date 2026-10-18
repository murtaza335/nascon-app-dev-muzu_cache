import { useState } from 'react';
import { View } from 'react-native';
import { useApp } from '../../app/AppContext';
import { Button,Chip,Field,Row,Screen,Sheet,T,ui } from '../../components/ui';
import { normalizeServer } from '../../services/api/client';
import { colors as c } from '../../theme/tokens';
export function SettingsScreen() {
  const p = useApp();
  const [url, setUrl] = useState(p.serverUrl);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState<'server' | 'logout' | null>(null);
  function review() {
    try {
      normalizeServer(url);
      setError('');
      setConfirm('server');
    }
    catch {
      setError('Use an http:// or https:// address without credentials, queries or fragments.');
    }
  }
  return <Screen title="Settings" back stateful={false} showStatus={!!p.session}>

    <View style={{ backgroundColor: c.surface, padding: 20, borderRadius: 16, gap: 12 }}>
      <T variant="section">
        Appearance
      </T>
      <View style={ui.wrap}>
        {[{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }, { value: 'system', label: 'Device' }].map(item => <Chip key={item.value} label={item.label} selected={p.themePreference === item.value} onPress={() => void p.setTheme(item.value as 'light' | 'dark' | 'system')} />)}
      </View>
    </View>

    <View style={{ padding: 20, borderRadius: 16, backgroundColor: c.olive, gap: 12 }}>
      <T variant="section">
        Server connection
      </T>
      <Field label="Server address" value={url} onChangeText={setUrl} keyboardType="url" autoCapitalize="none" autoCorrect={false} error={error || undefined} />
      <T variant="caption" color={c.secondary}>
        Backend: http://10.195.242.35:8080
      </T>
      <Button label="Save server address" disabled={url.trim().replace(/\/+$/, '') === p.serverUrl} onPress={review} />
    </View>

    {p.session && <View style={{ backgroundColor: c.surface, padding: 20, borderRadius: 16, gap: 12 }}>
      <T variant="section">
        Your session
      </T>
      <Row title={p.data.user?.display_name || 'Your account'} detail={p.data.user?.email} />
      <T color={c.secondary}>
        {p.pendingCount ? `${p.pendingCount} actions are waiting to sync.` : 'No work is waiting to sync.'}
      </T>
      <Button label="Sign out" kind="secondary" onPress={() => setConfirm('logout')} />
    </View>}

    <Sheet title={confirm === 'server' ? 'Change server?' : 'Sign out?'} open={!!confirm} onClose={() => setConfirm(null)}>
      <T>
        {confirm === 'server' ? 'Changing server signs you out. Pending work stays with the previous server and account.' : p.pendingCount ? `${p.pendingCount} actions are saved on this device. Keep them for your next sign-in or discard them explicitly.` : 'Your saved account data and cart will be cleared.'}
      </T>
      <Button label={confirm === 'server' ? 'Change server' : p.pendingCount ? 'Sign out and keep pending work' : 'Sign out'} onPress={() => void (confirm === 'server' ? p.setServerUrl(url) : p.logout()).then(ok => {
        if (ok)
          setConfirm(null);
      })} />
      {confirm === 'logout' && p.pendingCount > 0 && <Button label="Discard pending work and sign out" kind="danger" onPress={() => void p.logout(true).then(ok => {
        if (ok)
          setConfirm(null);
      })} />}
      <Button label="Cancel" kind="quiet" onPress={() => setConfirm(null)} />
    </Sheet>

  </Screen>;
}
