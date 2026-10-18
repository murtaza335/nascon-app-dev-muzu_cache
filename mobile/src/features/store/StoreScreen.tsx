import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import { ScrollView,useWindowDimensions,View } from 'react-native';
import { useApp } from '../../app/AppContext';
import { Button,Chip,Empty,Field,humanize,money,Screen,T,ui } from '../../components/ui';
import type { AppNavigation } from '../../navigation/routes';
import { colors as c } from '../../theme/tokens';
import { ProductCard } from './components/ProductCard';
export { ProductArt } from './components/ProductMedia';
export function StoreScreen() {
  const p = useApp();
  const n = useNavigation<AppNavigation>();
  const { width, fontScale } = useWindowDimensions();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const categories = [...new Set(p.data.products.map(x => x.category))];
  const products = p.data.products.filter(x => (category === 'all' || x.category === category) && `${x.name} ${x.category}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const columns = width < 350 || fontScale > 1.15 ? 1 : 2;
  const quantity = p.cart.reduce((sum, x) => sum + x.quantity, 0);
  const total = p.cart.reduce((sum, x) => sum + x.quantity * x.variant.price_minor, 0);
  return <Screen title="Club store" action={<Button label="Orders" kind="quiet" onPress={() => n.navigate('Orders')} />} skeleton="products">

    <View style={{ gap: 8 }}>
      <Field label="Find a product" placeholder="Search merchandise" value={query} onChangeText={setQuery} autoCorrect={false} />
      <ScrollView horizontal style={{ flexGrow: 0 }} showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        <Chip label="All" selected={category === 'all'} onPress={() => setCategory('all')} />
        {categories.map(value => <Chip key={value} label={humanize(value)} selected={category === value} onPress={() => setCategory(value)} />)}
      </ScrollView>
    </View>

    {quantity > 0 && <View style={{ padding: 16, backgroundColor: c.olive, borderRadius: 12, gap: 8 }}>
      <View style={ui.between}>
        <T variant="strong">
          {`${quantity} items in your cart`}
        </T>
        <T variant="strong">
          {money(total)}
        </T>
      </View>
      <Button label="Review cart" onPress={() => n.navigate('Cart')} />
    </View>}

    <View style={ui.between}>
      <T variant="section">
        {category === 'all' ? 'All merchandise' : humanize(category)}
      </T>
      <T variant="caption" color={c.secondary}>
        {`${products.length} products`}
      </T>
    </View>

    {products.length ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 20 }}>
      {products.map(product => <View key={product.product_id} style={{ width: columns === 1 ? '100%' : '46%', flexGrow: 1, maxWidth: columns === 1 ? '100%' : '48%' }}>
        <ProductCard product={product} />
      </View>)}
    </View> : <Empty title={query ? 'No matching products' : 'No products available'} body="Try another search or category, or refresh the store." action="Reset filters" onAction={() => {
      setQuery('');
      setCategory('all');
    }} icon="store" />}

    <Button label={quantity ? `Open cart (${quantity})` : 'Open cart'} kind="secondary" onPress={() => n.navigate('Cart')} />

  </Screen>;
}
