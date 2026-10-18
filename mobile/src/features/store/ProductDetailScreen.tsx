import { RouteProp,useNavigation,useRoute } from '@react-navigation/native';
import { useEffect,useState } from 'react';
import { View } from 'react-native';
import { useApp } from '../../app/AppContext';
import { Badge,Button,Chip,Empty,IconButton,Screen,Section,T,humanize,money,ui } from '../../components/ui';
import type { AppNavigation,StackParams } from '../../navigation/routes';
import { colors as c } from '../../theme/tokens';
import { ProductArt } from './components/ProductMedia';
export function ProductDetailScreen() {
  const p = useApp();
  const n = useNavigation<AppNavigation>();
  const r = useRoute<RouteProp<StackParams, 'ProductDetail'>>();
  const id = r.params?.productId;
  const product = p.data.products.find(x => x.product_id === id) || p.data.fixtures.map(x => x.pinned_product).find(x => x?.product_id === id);
  const [variantId, setVariant] = useState<string>();
  const [qty, setQty] = useState(1);
  const variant = product?.variants.find(x => x.variant_id === variantId);
  useEffect(() => {
    if (id)
      void p.fetchProduct(id);
  }, [id]);
  const buy = product ? <View style={{ gap: 8 }}>
    <View style={ui.between}>
      <T variant="caption" color={c.secondary}>
        {variant ? `${qty} items selected` : 'Select your option'}
      </T>
      {variant && <T variant="strong">
        {money(variant.price_minor * qty)}
      </T>}
    </View>
    <Button label={variant ? 'Add to cart' : 'Choose an option below'} disabled={!variant || variant.stock < qty} onPress={() => {
      if (variant)
        void p.addToCart({ productId: product.product_id, name: product.name, variant, quantity: qty });
    }} />
  </View> : undefined;
  return <Screen title="Product" back action={<Button label="Cart" kind="quiet" onPress={() => n.navigate('Cart')} />} footer={buy} skeleton="products">

    {!product ? <Empty title="Product unavailable" body="Return to the store or retry this product while connected." action="Try again" onAction={() => {
      if (id)
        void p.fetchProduct(id);
    }} icon="store" /> : <>

      <ProductArt product={product} large />
      <View style={{ gap: 8 }}>
        <T variant="caption" color={c.secondary}>
          {humanize(product.category)}
        </T>
        <T variant="heading">
          {product.name}
        </T>
        <T variant="title" color={c.accent}>
          {variant ? money(variant.price_minor) : product.variants.length ? `From ${money(Math.min(...product.variants.map(v => v.price_minor)))}` : 'Options unavailable'}
        </T>
        {product.description && <T color={c.secondary}>
          {product.description}
        </T>}
      </View>

      <Section title="Choose your option">
        <View style={ui.wrap}>
          {product.variants.map(v => <Chip key={v.variant_id} label={[v.size, v.color].filter(Boolean).join(' / ') || v.variant_id} selected={variantId === v.variant_id} onPress={() => {
            setVariant(v.variant_id);
            setQty(1);
          }} />)}
        </View>
        {variant ? <Badge label={variant.stock ? `${variant.stock} available` : 'Out of stock'} tone={variant.stock ? 'success' : 'warning'} /> : <T variant="caption" color={c.secondary}>
          Choose an option to check current availability.
        </T>}
      </Section>

      <View style={ui.between}>
        <T variant="strong">
          Quantity
        </T>
        <View style={ui.row}>
          <IconButton name="minus" label="Decrease quantity" onPress={() => setQty(Math.max(1, qty - 1))} />
          <T variant="title" accessibilityLiveRegion="polite">
            {qty}
          </T>
          <IconButton name="plus" label="Increase quantity" onPress={() => setQty(Math.min(10, variant?.stock || 10, qty + 1))} />
        </View>
      </View>
      <T variant="caption" color={c.secondary}>
        Current prices and stock are confirmed by the server at checkout.
      </T>

    </>}

  </Screen>;
}
