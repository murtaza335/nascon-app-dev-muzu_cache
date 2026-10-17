import { useNavigation } from '@react-navigation/native';
import type { AppNavigation } from '../../navigation/routes';
import { useState } from 'react';
import { usePreview } from '../../app/PreviewContext';
import { Button, Card, Field, Message, money, Row, Screen, Section, Select, T, ui } from '../../components/ui';
import { colors as c } from '../../theme/tokens';
export function CheckoutScreen() {
  const p=usePreview();const n=useNavigation<AppNavigation>();const [discount,setDiscount]=useState('');const [payment,setPayment]=useState('tok_success');
  const subtotal=p.cart.reduce((a,x)=>a+x.variant.price_minor*x.quantity,0);
  return <Screen title="Checkout" back><Section title="Your order"><Card>{p.cart.length?p.cart.map(x=><Row key={x.variant.variant_id} title={x.name} detail={`Quantity ${x.quantity}`} trailing={<T>{money(x.variant.price_minor*x.quantity)}</T>}/>):<T color={c.secondary}>Your selected items will appear here.</T>}<Row title="Estimated subtotal" trailing={<T variant="strong">{money(subtotal)}</T>}/></Card></Section>
    <Section title="Have a discount?"><Field label="Discount code (optional)" placeholder="Enter code" autoCapitalize="characters" value={discount} onChangeText={setDiscount}/><T variant="caption" color={c.muted}>Use WELCOME10 for a 10% mock discount. Prices and stock are checked before payment.</T></Section>
    <Section title="Payment"><Select label="Mock payment outcome" value={payment} options={[{value:'tok_success',label:'Successful payment'},{value:'tok_declined',label:'Payment declined'},{value:'tok_capture_fail',label:'Payment capture failed'}]} onChange={setPayment}/><T color={c.secondary}>This competition uses a mock payment gateway. No real payment information is needed.</T></Section>
    {p.connection==='offline'&&<Message title="Checkout needs a connection" description="Your cart stays here. Reconnect to confirm stock, prices and payment." tone="warning"/>}
    <Button label="Place order" disabled={!p.cart.length||p.connection==='offline'} busy={p.busy} onPress={()=>void p.run({kind:'checkout',lines:p.cart,discount,payment}).then(result=>{if(result.ok&&result.id)n.replace('Receipt',{orderId:result.id});})}/><T variant="caption" color={c.muted}>You’ll receive a receipt after payment is confirmed.</T>
  </Screen>;
}
