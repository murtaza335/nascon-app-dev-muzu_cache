import { useNavigation } from '@react-navigation/native';
import { View } from 'react-native';
import { Badge,T,Tap,humanize,money } from '../../../components/ui';
import type { AppNavigation } from '../../../navigation/routes';
import { colors as c } from '../../../theme/tokens';
import type { Product } from '../../../types/models';
import { ProductArt } from './ProductMedia';
export function ProductCard({ product }: {
  product: Product;
}) {
  const n = useNavigation<AppNavigation>();
  const stocked = product.variants.some(v => v.stock > 0);
  return <Tap label={`View ${product.name}`} onPress={() => n.navigate('ProductDetail', { productId: product.product_id })}>
    <View style={{ gap: 10 }}>
      <ProductArt product={product} />
      <T variant="caption" color={c.secondary}>
        {humanize(product.category)}
      </T>
      <T variant="strong">
        {product.name}
      </T>
      <T variant="strong" color={c.accent}>
        {product.variants.length ? `From ${money(Math.min(...product.variants.map(v => v.price_minor)))}` : 'Options unavailable'}
      </T>
      <Badge label={stocked ? 'Available' : 'Out of stock'} tone={stocked ? 'success' : 'warning'} />
    </View>
  </Tap>;
}
