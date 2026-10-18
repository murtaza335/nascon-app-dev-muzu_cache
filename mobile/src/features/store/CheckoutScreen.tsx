import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import { View } from 'react-native';
import { useApp } from '../../app/AppContext';
import { Button,Empty,Field,Message,Row,Screen,Section,Select,T,money,ui } from '../../components/ui';
import type { AppNavigation } from '../../navigation/routes';
import { colors as c } from '../../theme/tokens';
export function CheckoutScreen() {
  const p = useApp();
  const n = useNavigation<AppNavigation>();
  const [discount, setDiscount] = useState('');
  const [payment, setPayment] = useState('tok_success');
  const [failure, setFailure] = useState('');
  const subtotal = p.cart.reduce((sum, x) => sum + x.quantity * x.variant.price_minor, 0);
  async function checkout() {
    setFailure('');
    const result = await p.run({ kind: 'checkout', lines: p.cart, discount, payment });
    if (result.ok && result.id)
      n.replace('Receipt', { orderId: result.id });
    else if (!result.ok)
      setFailure(result.message);
  }
  return <Screen title="Checkout" back footer={p.cart.length ? <Button label={`Place order / ${money(subtotal)} estimated`} disabled={p.connection === 'offline'} busy={p.busy} onPress={() => void checkout()} /> : undefined}>

    {!p.cart.length ? <Empty title="Your cart is empty" body="Choose a product before checking out." action="Browse store" onAction={() => n.navigate('Main', { screen: 'Store' })} icon="store" /> : <>

      <Section title="Review your items">
        {p.cart.map(line => <Row key={line.variant.variant_id} title={line.name} detail={`${[line.variant.size, line.variant.color].filter(Boolean).join(' / ')} / Quantity ${line.quantity}`} trailing={<T variant="strong">
          {money(line.variant.price_minor * line.quantity)}
        </T>} />)}
        <Button label="Edit cart" kind="quiet" onPress={() => n.navigate('Cart')} />
      </Section>

      <Section title="Discount">
        <Field label="Discount code (optional)" value={discount} onChangeText={setDiscount} placeholder="Enter code" autoCapitalize="characters" />
      </Section>

      <Section title="Payment">
        <Select label="Competition mock payment" value={payment} options={[{ value: 'tok_success', label: 'Successful payment' }, { value: 'tok_declined', label: 'Declined payment (test)' }, { value: 'tok_capture_fail', label: 'Capture failure (test)' }]} onChange={setPayment} />
        <T variant="caption" color={c.secondary}>
          No card details or real money are used. The server confirms the result.
        </T>
      </Section>

      <View style={{ backgroundColor: c.surface, padding: 24, borderRadius: 16, gap: 8 }}>
        <T variant="section">
          Price summary
        </T>
        <Row title="Items subtotal" trailing={<T>
          {money(subtotal)}
        </T>} />
        <Row title="Discount" detail={discount.trim() ? 'Validated when placing your order' : 'No code entered'} />
        <View style={ui.between}>
          <T variant="strong">
            Estimated total
          </T>
          <T variant="title" color={c.accent}>
            {money(subtotal)}
          </T>
        </View>
        <T variant="caption" color={c.secondary}>
          Final prices, discount and stock are confirmed by the server.
        </T>
      </View>

      {p.connection === 'offline' && <Message title="Connect to place your order" description="Your cart is saved. Reconnect to confirm stock and payment." tone="warning" />}
      {!!failure && <Message title="Order not completed" description={failure} tone="error" />}

    </>}

  </Screen>;
}
