import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import { View } from 'react-native';
import { roleNames, useApp } from '../../app/AppContext';
import { Avatar, Badge, Button, Card, Dialog, Row, Screen, Section, Select, T, ui } from '../../components/ui';
import type { AppNavigation } from '../../navigation/routes';
import { colors as c } from '../../theme/tokens';
export function AccountScreen() {
  const [confirm,setConfirm]=useState(false); const p = useApp(); const n = useNavigation<AppNavigation>();
  return <Screen title="Account" back><View style={{ gap: 16, alignItems: 'center', paddingVertical: 16 }}><Avatar name={p.data.user?.display_name} size={72} /><T variant="heading">{p.data.user?.display_name || 'Your profile'}</T><T color={c.secondary}>{p.data.user?.email || 'Account details will appear here'}</T><Badge label={roleNames[p.role]} /></View>
    {p.role==='super_admin' && <Select label="Organization context" value={p.data.tenant?.tenant_id} options={(p.data.tenants || []).map(x=>({value:x.tenant_id,label:x.name}))} onChange={p.setTenantId}/> }
    <Section title="Your club"><Card><Row title={p.data.tenant?.name || 'Club & community'} detail="Club profile, team and staff" icon="roster" onPress={() => n.navigate('ClubProfile', { clubId: p.data.user?.club_id || undefined })} />{p.data.user?.player_id&&<Row title="Player profile" detail="Registration and player history" icon="person" onPress={() => n.navigate('PlayerProfile', { playerId: p.data.user?.player_id || undefined })} />}</Card></Section>
    {['super_admin','league_organizer','club_manager'].includes(p.role)&&<Section title="Your workspace"><Row title="Management" detail="Scoring, roster and order fulfillment" icon="settings" onPress={()=>n.navigate('Management')}/></Section>}
    <Section title="Your activity"><Card><Row title="Orders" detail="Purchases and receipts" icon="store" onPress={() => n.navigate('Orders')} /><View style={ui.divider} /><Row title="Sync status" detail="Pending work and results" icon="sync" onPress={() => n.navigate('SyncStatus')} /><View style={ui.divider} /><Row title="Settings" detail="Server and appearance" icon="settings" onPress={() => n.navigate('Settings')} /></Card></Section>
    <Button label="Sign out" kind="danger" onPress={()=>setConfirm(true)}/>
    <Dialog title="Sign out?" tone={p.pendingCount?'warning':'neutral'} open={confirm} onClose={()=>setConfirm(false)} body={p.pendingCount ? `You have ${p.pendingCount} pending actions. Keep them for your next sign-in or discard them.` : 'Your cart and cached account data will be cleared from this device.'}><Button label={p.pendingCount?'Sign out and keep pending work':'Sign out'} onPress={()=>void p.logout(false)}/>{p.pendingCount>0&&<Button label="Discard pending work and sign out" kind="danger" onPress={()=>void p.logout(true)}/>}<Button label="Cancel" kind="quiet" onPress={()=>setConfirm(false)}/></Dialog>
  </Screen>;
}
