import { RouteProp,useNavigation,useRoute } from '@react-navigation/native';
import { useEffect,useState } from 'react';
import { View } from 'react-native';
import { useApp } from '../../app/AppContext';
import { Icon } from '../../components/Icon';
import { Badge,Button,dateLabel,Empty,humanize,money,Row,Screen,T } from '../../components/ui';
import type { AppNavigation,StackParams } from '../../navigation/routes';
import { colors as c } from '../../theme/tokens';
export function ReceiptScreen() {
  const p = useApp();
  const n = useNavigation<AppNavigation>();
  const r = useRoute<RouteProp<StackParams, 'Receipt'>>();
  const id = r.params?.orderId;
  const order = p.data.orders.find(x => x.order_id === id);
  const [exporting, setExporting] = useState(false);
  useEffect(() => {
    if (id)
      void p.fetchOrder(id);
  }, [id]);
  async function exportPdf(download: boolean) {
    if (!order)
      return;
    setExporting(true);
    try {
      const result = await p.exportReceipt(order.order_id, download);
      p.notify(result === 'cancelled' ? 'Download cancelled.' : result === 'saved' ? 'Receipt saved.' : 'Receipt opened in your PDF viewer.');
    }
    catch (error) {
      p.notify(error instanceof Error ? error.message : 'Could not export the receipt. Try again.');
    }
    finally {
      setExporting(false);
    }
  }
  return <Screen title="Receipt" back>

    {!order ? <Empty title="Receipt unavailable" body="Open an order to view its receipt." action="View orders" onAction={() => n.navigate('Orders')} icon="store" /> : <>

      <View style={{ gap: 16, alignItems: 'center', paddingVertical: 16 }}>

        <View style={{ width: 64, height: 64, borderRadius: 16, backgroundColor: c.olive, alignItems: 'center', justifyContent: 'center' }}>

          <Icon name={order.payment?.state === 'captured' || order.status === 'paid' ? 'check' : 'store'} color={c.accent} size={32} />

        </View>

        <T variant="heading">

          {order.payment?.state === 'captured' || order.status === 'paid' ? 'Payment confirmed' : 'Order receipt'}

        </T>

        <T variant="title" color={c.accent}>

          {money(order.total_minor, order.currency)}

        </T>

      </View>

      <View style={{ backgroundColor: c.surface, padding: 24, borderRadius: 16, gap: 12 }}>

        <T variant="section">

          {p.data.tenant?.name || 'Sportron'}

        </T>

        <Badge label={humanize(order.status)} tone={order.status === 'paid' ? 'success' : 'neutral'} />

        <Row title="Order" detail={order.order_id} />

        {order.items.map(item => <Row key={item.variant_id} title={item.name || item.variant_id} detail={`${item.quantity} × ${money(item.unit_price_minor, order.currency)}`} trailing={<T>

          {money(item.unit_price_minor * item.quantity, order.currency)}

        </T>} />)}

        <Row title="Total" trailing={<T variant="strong">

          {money(order.total_minor, order.currency)}

        </T>} />

        {order.paid_at && <T variant="caption" color={c.secondary}>

          {dateLabel(order.paid_at)}

        </T>}

      </View>

      <Button label="Open receipt PDF" disabled={exporting || p.connection === 'offline'} busy={exporting} onPress={() => void exportPdf(false)} />

      <Button label="Download receipt" kind="secondary" disabled={exporting || p.connection === 'offline'} onPress={() => void exportPdf(true)} />

      <Button label="Continue shopping" kind="quiet" onPress={() => n.navigate('Main', { screen: 'Store' })} />

    </>}

  </Screen>;
}
