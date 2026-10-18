import { RouteProp,useNavigation,useRoute } from '@react-navigation/native';
import { useEffect } from 'react';
import { View } from 'react-native';
import { useApp } from '../../app/AppContext';
import { Badge,Button,dateLabel,Empty,humanize,money,Row,Screen,Section,T } from '../../components/ui';
import type { AppNavigation,StackParams } from '../../navigation/routes';
import { colors as c } from '../../theme/tokens';
export function OrderDetailScreen() {
  const p = useApp();
  const n = useNavigation<AppNavigation>();
  const r = useRoute<RouteProp<StackParams, 'OrderDetail'>>();
  const id = r.params?.orderId;
  const order = p.data.orders.find(x => x.order_id === id);
  useEffect(() => {
    if (id)
      void p.fetchOrder(id);
  }, [id]);
  return <Screen title="Order details" back>

    {!order ? <Empty title="Order unavailable" body="Return to Orders, or retry this order while connected." action="Retry order" onAction={() => {
      if (id)
        void p.fetchOrder(id);
    }} icon="store" /> : <>

      <View style={{ gap: 12 }}>

        <Badge label={humanize(order.status)} tone={order.status === 'paid' ? 'success' : 'neutral'} />

        <T variant="title">

          {order.order_id}

        </T>

        {order.created_at && <T variant="caption" color={c.secondary}>

          {dateLabel(order.created_at)}

        </T>}

      </View>

      <Section title="Items">

        {order.items.map(item => <Row key={item.variant_id} title={item.name || item.variant_id} detail={`Quantity ${item.quantity}`} trailing={<T variant="strong">

          {money(item.quantity * item.unit_price_minor, order.currency)}

        </T>} />)}

      </Section>

      <Section title="Summary">

        <Row title="Subtotal" trailing={<T>

          {money(order.subtotal_minor, order.currency)}

        </T>} />

        <Row title="Discount" trailing={<T>

          {money(order.discount_minor, order.currency)}

        </T>} />

        <Row title="Total" trailing={<T variant="title" color={c.accent}>

          {money(order.total_minor, order.currency)}

        </T>} />

        {order.payment && <Row title="Payment" detail={humanize(order.payment.state)} />}

      </Section>

      <Button label="View receipt" onPress={() => n.navigate('Receipt', { orderId: order.order_id })} />

      {['super_admin', 'club_manager'].includes(p.role) && <Button label="Manage fulfillment" kind="secondary" onPress={() => n.navigate('OrderManagement', { orderId: order.order_id })} />}

    </>}

  </Screen>;
}
