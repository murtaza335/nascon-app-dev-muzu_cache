import { useState } from 'react';
import { View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useApp } from '../../app/AppContext';
import { Badge, Empty, Button, Chip, humanize, IconButton, money, Screen, Section, T, ui } from '../../components/ui';
import type { AppNavigation, StackParams } from '../../navigation/routes';
import { colors as c } from '../../theme/tokens';
import { ProductArt } from './StoreScreen';
export function ProductDetailScreen() {
  const p=useApp();const n=useNavigation<AppNavigation>();const r=useRoute<RouteProp<StackParams,'ProductDetail'>>();
  const product=p.data.products.find(x=>x.product_id===r.params?.productId) || p.data.fixtures.map(x=>x.pinned_product).find(x=>x?.product_id===r.params?.productId) || (!r.params?.productId ? p.data.products[0] : undefined);
  const [variantId,setVariantId]=useState<string>();const [qty,setQty]=useState(1);const selected=product?.variants.find(x=>x.variant_id===variantId);
  if(!product) return <Screen title="Product details" back skeleton="products"><Empty title="Product unavailable" body="This product is no longer available. Return to the store and refresh."/></Screen>;
  return <Screen title="Product details" back stateful skeleton="products" action={<Button label="Cart" kind="quiet" onPress={()=>n.navigate('Cart')}/> }><ProductArt product={product || undefined} large/><View style={{gap:12}}><T variant="heading">{product?.name || 'Made for your club'}</T><View style={ui.between}><T variant="title" color={c.accent}>{selected?money(selected.price_minor):product?.variants.length?`From ${money(Math.min(...product.variants.map(x=>x.price_minor)))}`:'Price to be confirmed'}</T>{product&&<Badge label={humanize(product.category)}/>}</View><T color={c.secondary}>{product?.description || 'Product details, available options and club information will appear here.'}</T></View>
    <Section title="Choose your variant"><View style={ui.wrap}>{product?.variants.map(v=><Chip key={v.variant_id} label={[v.size,v.color].filter(Boolean).join(' · ')||v.variant_id} selected={variantId===v.variant_id} onPress={()=>setVariantId(v.variant_id)}/>)}</View>{!product?.variants.length&&<T color={c.secondary}>Variants will appear with the product.</T>}{selected&&<Badge label={selected.stock>0?`${selected.stock} available`:'Currently sold out'} tone={selected.stock>0?'success':'warning'}/>}</Section>
    <View style={ui.between}><T variant="strong">Quantity</T><View style={ui.row}><IconButton name="minus" label="Decrease quantity" onPress={()=>setQty(Math.max(1,qty-1))}/><T variant="title" accessibilityLiveRegion="polite">{qty}</T><IconButton name="plus" label="Increase quantity" onPress={()=>setQty(Math.min(10,qty+1))}/></View></View>
    <Button label="Add to cart" disabled={!product||!selected||selected.stock<qty} onPress={()=>{if(product&&selected)p.addToCart({productId:product.product_id,name:product.name,variant:selected,quantity:qty});}}/><T variant="caption" color={c.muted}>Final availability and pricing are confirmed at checkout.</T>
  </Screen>;
}
