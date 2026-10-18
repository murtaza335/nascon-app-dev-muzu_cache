import { useNavigation } from '@react-navigation/native';
import { View } from 'react-native';
import { useApp } from '../../app/AppContext';
import { Button,Empty,IconButton,money,Screen,Section,T,ui } from '../../components/ui';
import type { AppNavigation } from '../../navigation/routes';
import { colors as c } from '../../theme/tokens';
export function CartScreen() {
  const p = useApp();
  const n = useNavigation<AppNavigation>();
  const subtotal = p.cart.reduce((sum, x) => sum + x.quantity * x.variant.price_minor, 0);
  return <Screen title="Your cart" back stateful={false}>

    {p.cart.length ? <>

      <Section title={`${p.cart.length} selected ${p.cart.length === 1 ? 'item' : 'items'}`}>

        {p.cart.map(line => <View key={line.variant.variant_id} style={{ paddingBottom: 20, borderBottomWidth: 1, borderColor: c.divider, gap: 12 }}>

          <View style={ui.between}>

            <View style={[ui.grow, { gap: 4 }]}>

              <T variant="strong">

                {line.name}

              </T>

              <T variant="caption" color={c.secondary}>

                {[line.variant.size, line.variant.color].filter(Boolean).join(' · ')}

              </T>

            </View>

            <T variant="strong">

              {money(line.variant.price_minor * line.quantity)}

            </T>

          </View>

          <View style={ui.between}>

            <View style={ui.row}>

              <IconButton name="minus" label={`Decrease ${line.name} quantity`} onPress={() => {
                if (line.quantity > 1)
                  void p.setCart(prev => prev.map(x => x.variant.variant_id === line.variant.variant_id ? { ...x, quantity: x.quantity - 1 } : x));
              }} />

              <T variant="strong" accessibilityLiveRegion="polite">

                {line.quantity}

              </T>

              <IconButton name="plus" label={`Increase ${line.name} quantity`} onPress={() => {
                if (line.quantity < Math.min(10, line.variant.stock))
                  void p.setCart(prev => prev.map(x => x.variant.variant_id === line.variant.variant_id ? { ...x, quantity: x.quantity + 1 } : x));
                else
                  p.notify('No more of this option are available.');
              }} />

            </View>

            <Button label="Remove" kind="quiet" onPress={() => void p.setCart(prev => prev.filter(x => x.variant.variant_id !== line.variant.variant_id))} />

          </View>

        </View>)}

      </Section>

      <View style={[ui.between, { paddingVertical: 8 }]}>

        <T variant="strong">

          Estimated total

        </T>

        <T variant="title" color={c.accent}>

          {money(subtotal)}

        </T>

      </View>

      <T variant="caption" color={c.secondary}>

        Discounts and current stock are checked at checkout. Cart changes can be undone.

      </T>

      <Button label="Continue to checkout" onPress={() => n.navigate('Checkout')} />

      <Button label="Keep shopping" kind="quiet" onPress={() => n.navigate('Main', { screen: 'Store' })} />

    </> : <Empty title="Your cart is empty" body="Choose a product and an option from your club store to get started." action="Browse the store" onAction={() => n.navigate('Main', { screen: 'Store' })} icon="store" />}

  </Screen>;
}
