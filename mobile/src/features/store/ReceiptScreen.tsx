
import { useState } from 'react';
import { View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useApp } from '../../app/AppContext';
import { Badge, Empty, Button, Card, dateLabel, money, Row, Screen, T, ui } from '../../components/ui';
import { Icon } from '../../components/Icon';
import type { AppNavigation, StackParams } from '../../navigation/routes';
import { colors as c } from '../../theme/tokens';
export function ReceiptScreen() {
  const p=useApp();const [exporting,setExporting]=useState(false);async function exportPdf(download:boolean){if(!order)return;setExporting(true);try{const result=await p.exportReceipt(order.order_id,download);p.notify(result==='cancelled'?'Download cancelled.':result==='saved'?'Receipt saved to your chosen location.':'Receipt opened in your PDF viewer.');}catch(error){p.notify(error instanceof Error?error.message:'Could not export receipt. Try again.');}finally{setExporting(false);}}const n=useNavigation<AppNavigation>();const r=useRoute<RouteProp<StackParams,'Receipt'>>();const order=p.data.orders.find(x=>x.order_id===r.params?.orderId) || (!r.params?.orderId ? p.data.orders[0] : undefined);
  if(!order) return <Screen title="Receipt unavailable" back><Empty title="Receipt unavailable" body="Open a completed order to view its receipt."/></Screen>;
  return <Screen title="Your receipt" back stateful><View style={{alignItems:'center',gap:16,paddingVertical:12}}><View style={{width:64,height:64,borderRadius:32,backgroundColor:c.olive,alignItems:'center',justifyContent:'center'}}><Icon name={order?.status==='paid'?'check':'store'} color={c.accent} size={30}/></View><T variant="heading">{order?.status==='paid'?'Payment confirmed':'Receipt'}</T><T color={c.secondary} style={{textAlign:'center'}}>{order?.status==='paid'?'Thank you for supporting your club.':'Confirmed receipt information will appear here.'}</T></View>
    <Card style={{padding:24,gap:20}}><View style={ui.between}><T variant="strong" style={ui.grow}>{p.data.tenant?.name||'NaSCon Sports'}</T><Badge label={order?.status==='paid'?'Paid':order?.status||'Unavailable'} tone={order?.status==='paid'?'success':'neutral'}/></View><View style={ui.divider}/><Row title="Order" detail={order?.order_id||'Awaiting order details'}/>{order?.items.map(item=><Row key={item.variant_id} title={item.name||item.variant_id} detail={`${item.quantity} × ${money(item.unit_price_minor,order.currency)}`} trailing={<T>{money(item.unit_price_minor*item.quantity,order.currency)}</T>}/>)}<View style={ui.divider}/><Row title="Total" trailing={<T variant="title" color={c.accent}>{order?money(order.total_minor,order.currency):'—'}</T>}/><T variant="caption" color={c.muted}>{order?.paid_at?dateLabel(order.paid_at):'Payment time appears after confirmation.'}</T></Card>
    <Button label="Open receipt PDF" icon="next" disabled={!order||exporting} busy={exporting} onPress={()=>void exportPdf(false)}/><Button label="Download receipt" kind="secondary" disabled={!order||exporting} onPress={()=>void exportPdf(true)}/><Button label="Continue browsing" kind="quiet" onPress={()=>n.navigate('Main',{screen:'Store'})}/>
  </Screen>;
}
