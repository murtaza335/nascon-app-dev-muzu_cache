import { useState } from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { usePreview, roleNames } from '../../app/PreviewContext';
import { Avatar, Button, Field, Message, Screen, Select, T, ui } from '../../components/ui';
import type { AppNavigation } from '../../navigation/routes';
import { demoAccounts, demoPassword } from '../../services/mock/seed';
import { colors as c } from '../../theme/tokens';

// MOB-01: local demo authentication; production credentials are never sent.
export function LoginScreen(){
  const p=usePreview();const n=useNavigation<AppNavigation>();
  const [email,setEmail]=useState('');const [password,setPassword]=useState('');const [show,setShow]=useState(false);const [submitted,setSubmitted]=useState(false);const [failed,setFailed]=useState(false);
  async function signIn(){setSubmitted(true);setFailed(false);if(!/^\S+@\S+\.\S+$/.test(email)||!password)return;const ok=await p.login(email,password);if(ok)setPassword('');else setFailed(true);}
  return <Screen title="NaSCon Sports" showStatus={false} stateful={false}><View style={{gap:28,paddingVertical:12}}>
    <View style={{gap:20}}><Avatar name="NaSCon Sports" size={64}/><View><T variant="display" accessibilityRole="header">Your league.</T><T variant="display">Within reach.</T></View><T color={c.secondary}>Fixtures, live moments and the people who make your club.</T></View>
    <View style={{gap:16}}><T variant="section">Sign in</T><Field label="Email" placeholder="you@example.com" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" error={submitted&&!/^\S+@\S+\.\S+$/.test(email)?'Enter a valid email address.':undefined}/>
    <Field label="Password" placeholder="Your password" value={password} onChangeText={setPassword} secureTextEntry={!show} autoComplete="current-password" error={submitted&&!password?'Enter your password.':undefined}/><Button label={show?'Hide password':'Show password'} kind="quiet" onPress={()=>setShow(!show)} style={{alignSelf:'flex-end'}}/>
    {failed&&<Message title="Sign-in was unsuccessful" description="Check the demo email and password, or reconnect and try again." tone="error"/>}<Button label="Sign in" busy={p.busy} disabled={p.busy} onPress={()=>void signIn()}/></View>
    <View style={ui.divider}/><Message title="Local mock application" description="Use a demo account below. Changes are saved on this device; no real server or payment is contacted."/>
    <Select label="Use a demo account" value={demoAccounts.find(x=>x.email===email)?.role} options={demoAccounts.map(x=>({value:x.role,label:roleNames[x.role]}))} onChange={role=>{const account=demoAccounts.find(x=>x.role===role)!;setEmail(account.email);setPassword(demoPassword);setFailed(false);}}/>
    <T variant="caption" color={c.muted}>Demo password: {demoPassword}</T><Button label="Server and appearance settings" kind="quiet" onPress={()=>n.navigate('Settings')}/>
  </View></Screen>;
}
