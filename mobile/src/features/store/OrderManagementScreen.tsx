import { useRoute } from '@react-navigation/native';
import { useEffect,useState } from 'react';
import { useApp } from '../../app/AppContext';
import { Badge,Button,Empty,humanize,Message,money,Row,Screen,Section,Select,Sheet,T } from '../../components/ui';
export function OrderManagementScreen() {
  const p = useApp();
  const r = useRoute();
  const requested = (r.params as {
    orderId?: string;
  } | undefined)?.orderId;
  const [id, setId] = useState(requested);
  const [to, setTo] = useState<string>();
  const [review, setReview] = useState(false);
  const order = p.data.orders.find(x => x.order_id === id);
  const transitions: Record<string, string[]> = { pending: ['paid', 'cancelled'], paid: ['packed', 'cancelled', 'refunded'], packed: ['shipped', 'cancelled', 'refunded'], shipped: ['delivered', 'refunded'], delivered: ['refunded'] };
  useEffect(() => {
    if (id)
      void p.fetchOrder(id);
  }, [id]);
  const options = (order ? transitions[order.status] : []) || [];
  return <Screen title="Order fulfillment" back>

    {!['super_admin', 'club_manager'].includes(p.role) ? <Empty title="Manager access required" body="Fulfillment is available to the order's club manager." icon="store" /> : <>

      <Select label="Order" value={id} options={p.data.orders.map(x => ({ value: x.order_id, label: `${x.order_id} - ${humanize(x.status)}` }))} onChange={value => {
        setId(value);
        setTo(undefined);
      }} />

      {order ? <>

        <Badge label={humanize(order.status)} />

        <Row title="Order total" detail={money(order.total_minor, order.currency)} />

        <Section title="Update fulfillment">

          {options.length ? <Select label="Next state" value={to} options={options.map(value => ({ value, label: humanize(value) }))} onChange={setTo} /> : <T>

            No further transitions are available for this order.

          </T>}

          <Button label="Review order change" disabled={!options.includes(to || '') || p.connection === 'offline'} onPress={() => setReview(true)} />

        </Section>

      </> : <Empty title={p.data.orders.length ? 'Choose an order' : 'No orders available'} body="Select an order above to manage its next fulfillment step." icon="store" />}

      <Sheet title="Confirm order change" open={review} onClose={() => setReview(false)}>

        <Row title="Order" detail={id} />

        <Row title="Change" detail={`${humanize(order?.status || '')} to ${humanize(to || '')}`} />

        {['cancelled', 'refunded'].includes(to || '') && <Message title="Cancellation or refund" description="The server checks whether this action is available for the order." tone="warning" />}

        <Button label="Confirm change" kind={['cancelled', 'refunded'].includes(to || '') ? 'danger' : 'primary'} onPress={() => {
          if (order && to)
            void p.run({ kind: 'orderTransition', orderId: order.order_id, to }).then(result => {
              if (result.ok) {
                setReview(false);
                setTo(undefined);
              }
            });
        }} />

        <Button label="Keep editing" kind="quiet" onPress={() => setReview(false)} />

      </Sheet>

    </>}

  </Screen>;
}
