import { useNavigation } from '@react-navigation/native';
import { View } from 'react-native';
import { useApp } from '../../app/AppContext';
import { Badge,dateLabel,Empty,humanize,money,Screen,T,Tap,ui } from '../../components/ui';
import type { AppNavigation } from '../../navigation/routes';
import { colors as c } from '../../theme/tokens';
export function OrdersScreen() {
  const p = useApp();
  const n = useNavigation<AppNavigation>();
  return <Screen title="Orders" back subtitle="Purchases, progress and receipts.">

    {p.data.orders.length ? p.data.orders.map(order => <Tap key={order.order_id} label={`Open order ${order.order_id}`} onPress={() => n.navigate('OrderDetail', { orderId: order.order_id })}>

      <View style={{ gap: 12, paddingBottom: 24, borderBottomWidth: 1, borderColor: c.divider }}>

        <View style={[ui.between, { flexWrap: 'wrap' }]}>

          <Badge label={humanize(order.status)} tone={order.status === 'paid' ? 'success' : 'neutral'} />

          <T variant="strong">

            {money(order.total_minor, order.currency)}

          </T>

        </View>

        <T variant="strong">

          {order.order_id}

        </T>

        <T variant="caption" color={c.secondary}>{`${(order.items.reduce((sum, x) => sum + x.quantity, 0))} items ${(order.created_at ? ` · ${dateLabel(order.created_at)}` : '')}`}</T>

      </View>

    </Tap>) : <Empty title="No orders yet" body="Your purchases and receipts will appear here after checkout." action="Browse the store" onAction={() => n.navigate('Main', { screen: 'Store' })} icon="store" />}

  </Screen>;
}
