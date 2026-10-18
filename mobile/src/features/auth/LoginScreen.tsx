import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import { View } from 'react-native';
import { useApp } from '../../app/AppContext';
import { Button,Field,Message,Screen,T } from '../../components/ui';
import type { AppNavigation } from '../../navigation/routes';
import { colors as c } from '../../theme/tokens';
export function LoginScreen() {
  const p = useApp();
  const n = useNavigation<AppNavigation>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [failed, setFailed] = useState(false);
  const validEmail = /^\S+@\S+\.\S+$/.test(email.trim());
  async function signIn() {
    setSubmitted(true);
    setFailed(false);
    if (!validEmail || !password)
      return;
    const ok = await p.login(email, password);
    if (ok)
      setPassword('');
    else
      setFailed(true);
  }
  return <Screen title="Sportron" showStatus={false} stateful={false} action={<Button label="Settings" kind="quiet" onPress={() => n.navigate('Settings')} />}>

    <View style={{ backgroundColor: c.surface, padding: 20, borderRadius: 16, gap: 12 }}>
      <T variant="section">
        Sign in
      </T>
      <Field label="Email address" placeholder="you@example.com" value={email} onChangeText={setEmail} keyboardType="email-address" autoComplete="email" autoCapitalize="none" autoCorrect={false} error={submitted && !validEmail ? 'Enter a valid email address.' : undefined} />
      <View style={{ gap: 4 }}>
        <Field label="Password" placeholder="Enter your password" value={password} onChangeText={setPassword} secureTextEntry={!visible} autoComplete="current-password" returnKeyType="done" onSubmitEditing={() => void signIn()} error={submitted && !password ? 'Enter your password.' : undefined} />
        <Button label={visible ? 'Hide password' : 'Show password'} kind="quiet" style={{ alignSelf: 'flex-end' }} onPress={() => setVisible(!visible)} />
      </View>
      {failed && <Message title="Unable to sign in" description="Check your account details and server connection, then try again." tone="error" />}
      <Button label="Sign in" busy={p.busy} onPress={() => void signIn()} />
    </View>

    <T variant="caption" color={c.secondary}>
      Use your organization account.
    </T>

  </Screen>;
}
