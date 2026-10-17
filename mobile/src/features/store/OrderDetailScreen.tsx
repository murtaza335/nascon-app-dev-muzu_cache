import { View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useApp } from '../../app/AppContext';
import { Badge, Button, Card, dateLabel, humanize, money, Row, Screen, Section, T, ui } from '../../components/ui';
import type { AppNavigation, StackParams } from '../../navigation/routes';
import { colors as c } from '../../theme/tokens';
export function OrderDetailScreen() {
  const p=useApp();const n=useNavigation<AppNavigation>();const r=useRoute<RouteProp<StackParams,'OrderDetail'>>();const order=p.data.orders.find(x=>x.order_id===r.params?.orderId) || (!r.params?.orderId ? p.data.orders[0] : undefined);
  return <Screen title="Order details" back stateful skeleton="detail"><Card><Badge label={order?humanize(order.status):'Order unavailable'} tone={order?.status==='paid'?'success':'neutral'}/><T variant="heading">{order?.order_id||'Your order'}</T><T color={c.secondary}>{order?.created_at?dateLabel(order.created_at):'Order information will appear here.'}</T></Card>
    <Section title="Your items">{order?.items.length?order.items.map(item=><Row key={item.variant_id} title={item.name||item.variant_id} detail={`Quantity ${item.quantity}`} trailing={<T>{money(item.quantity*item.unit_price_minor,order.currency)}</T>}/>):<T color={c.secondary}>Purchased items and variants will be listed here.</T>}</Section>
    <Section title="Order summary"><Card><Row title="Subtotal" trailing={<T>{order?money(order.subtotal_minor,order.currency):'—'}</T>}/><Row title="Discount" trailing={<T>{order?money(order.discount_minor,order.currency):'—'}</T>}/><View style={ui.divider}/><Row title="Total" trailing={<T variant="title" color={c.accent}>{order?money(order.total_minor,order.currency):'—'}</T>}/></Card></Section>
    <Section title="Payment"><T color={c.secondary}>{order?.payment?humanize(order.payment.state):'Payment details become available after checkout.'}</T></Section>{order&&['super_admin','club_manager'].includes(p.role)&&<Button label="Manage fulfillment" kind="secondary" onPress={()=>n.navigate('OrderManagement',{orderId:order.order_id})}/>}<Button label="View receipt" onPress={()=>n.navigate('Receipt',{orderId:order?.order_id})} disabled={!order}/>
  </Screen>;
}
