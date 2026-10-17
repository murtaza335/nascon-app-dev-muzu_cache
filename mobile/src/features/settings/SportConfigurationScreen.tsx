import { useState } from 'react';
import { usePreview } from '../../app/PreviewContext';
import { Button, Empty, Field, Message, Row, Screen, Section } from '../../components/ui';
export function SportConfigurationScreen(){
  const p=usePreview();const [name,setName]=useState('');const [event,setEvent]=useState('');const [points,setPoints]=useState('1');
  if(p.role!=='super_admin')return <Screen title="Scoring configuration" back><Empty title="Platform admin access required" body="Sport configuration is restricted to the platform admin."/></Screen>;
  return <Screen title="Scoring configuration" back><Message title="Configuration-driven scoring" description="Add a mock scoring event for this organization. Existing events and values are preserved so historical scores remain stable. This local form is not a production sport-registration API."/><Field label="Display label" value={name} onChangeText={setName}/><Field label="Event identifier" value={event} onChangeText={setEvent} autoCapitalize="none" placeholder="An identifier from your sport configuration"/><Field label="Points" value={points} onChangeText={setPoints} keyboardType="number-pad"/><Button label="Add scoring event" disabled={p.connection==='offline'} onPress={()=>void p.run({kind:'sport',name,event,points:Number(points)}).then(result=>{if(result.ok){setName('');setEvent('');}})}/><Section title="Available events">{p.data.eventTypes.map(x=><Row key={x.value} title={x.label} detail={`${x.value} · ${x.points||1} points`}/>)}</Section></Screen>;
}
