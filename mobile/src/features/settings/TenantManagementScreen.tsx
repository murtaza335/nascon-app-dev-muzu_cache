import { useState } from 'react';
import { usePreview } from '../../app/PreviewContext';
import { Avatar, Button, Empty, Field, Message, Screen, Select } from '../../components/ui';
export function TenantManagementScreen(){
  const p=usePreview();const [name,setName]=useState(p.data.tenant?.name||'');const [primary,setPrimary]=useState(p.data.tenant?.colors?.primary||'');const [secondary,setSecondary]=useState(p.data.tenant?.colors?.secondary||'');
  if(p.role!=='super_admin')return <Screen title="Organization branding" back><Empty title="Platform admin access required" body="Organization branding is restricted to the platform admin."/></Screen>;
  return <Screen title="Organization branding" back><Select label="Organization" value={p.data.tenant?.tenant_id} options={(p.data.tenants||[]).map(x=>({value:x.tenant_id,label:x.name}))} onChange={id=>void p.setTenantId(id)}/><Avatar name={p.data.tenant?.name} uri={p.data.tenant?.logo_url} size={64}/><Field label="Organization name" value={name} onChangeText={setName}/><Field label="Primary color" placeholder="#163D32" value={primary} onChangeText={setPrimary} autoCapitalize="none"/><Field label="Secondary color" placeholder="#F2D675" value={secondary} onChangeText={setSecondary} autoCapitalize="none"/><Message title="Readable identity" description="Supplied colors appear as decorative identity marks. Text and semantic status colors retain the accessible app palette."/><Button label="Save organization branding" disabled={p.connection==='offline'} onPress={()=>void p.run({kind:'tenant',name,primary,secondary})}/></Screen>;
}
