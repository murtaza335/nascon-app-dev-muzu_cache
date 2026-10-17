import { useState } from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useApp, roleNames } from '../../app/AppContext';
import { Avatar, Button, Field, Message, Screen, Select, T, ui } from '../../components/ui';
import type { AppNavigation } from '../../navigation/routes';

import { colors as c } from '../../theme/tokens';

// MOB-01: credentials are sent only to the configured production API.
export function LoginScreen(){
  const p=useApp();const n=useNavigation<AppNavigation>();
  const [email,setEmail]=useState('');const [password,setPassword]=useState('');const [show,setShow]=useState(false);const [submitted,setSubmitted]=useState(false);const [failed,setFailed]=useState(false);
  async function signIn(){setSubmitted(true);setFailed(false);if(!/^\S+@\S+\.\S+$/.test(email)||!password)return;const ok=await p.login(email,password);if(ok)setPassword('');else setFailed(true);}
  return <Screen title="NaSCon Sports" showStatus={false} stateful={false}><View style={{gap:28,paddingVertical:12}}>
    <View style={{gap:20}}><Avatar name="NaSCon Sports" size={64}/><View><T variant="heading" accessibilityRole="header">Welcome back</T></View><T color={c.secondary}>Sign in to follow your competitions and manage your club.</T></View>
    <View style={{gap:16}}><T variant="section">Sign in</T><Field label="Email" placeholder="you@example.com" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" error={submitted&&!/^\S+@\S+\.\S+$/.test(email)?'Enter a valid email address.':undefined}/>
    <Field label="Password" placeholder="Your password" value={password} onChangeText={setPassword} secureTextEntry={!show} autoComplete="current-password" error={submitted&&!password?'Enter your password.':undefined}/><Button label={show?'Hide password':'Show password'} kind="quiet" onPress={()=>setShow(!show)} style={{alignSelf:'flex-end'}}/>
    {failed&&<Message title="Sign-in was unsuccessful" description="Check your email and password, or your server connection, and try again." tone="error"/>}<Button label="Sign in" busy={p.busy} disabled={p.busy} onPress={()=>void signIn()}/></View>
    <Button label="Server and appearance settings" kind="quiet" onPress={()=>n.navigate('Settings')}/>

  </View></Screen>;
}
