import { useNavigation } from '@react-navigation/native';
import { View } from 'react-native';
import { useApp } from '../../app/AppContext';
import { Badge, Card, dateLabel, Empty, humanize, money, Row, Screen, T, ui } from '../../components/ui';
import type { AppNavigation } from '../../navigation/routes';
import { colors as c } from '../../theme/tokens';
export function OrdersScreen() {
  const p=useApp();const n=useNavigation<AppNavigation>();
  return <Screen title="Your orders" subtitle="The things that bring us together" back stateful skeleton="list">{p.data.orders.length?<View style={{gap:16}}>{p.data.orders.map(order=><Card key={order.order_id}><Row title={order.order_id} detail={dateLabel(order.created_at)} onPress={()=>n.navigate('OrderDetail',{orderId:order.order_id})}/><View style={[ui.between,{flexWrap:'wrap'}]}><Badge label={humanize(order.status)} tone={order.status==='paid'||order.status==='delivered'?'success':'neutral'}/><T variant="strong">{money(order.total_minor,order.currency)}</T></View><T variant="caption" color={c.muted}>{order.items.reduce((a,x)=>a+x.quantity,0)} items</T></Card>)}</View>:<Empty title="Your first order awaits" body="Completed purchases, order updates and receipts will be easy to find here." icon="store" action="Explore the store" onAction={()=>n.navigate('Main',{screen:'Store'})}/>}</Screen>;
}
