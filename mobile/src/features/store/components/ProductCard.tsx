import { useNavigation } from '@react-navigation/native';
import { View } from 'react-native';
import { Badge,T,Tap,humanize,money,ui } from '../../../components/ui';
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
    <View style={{
      backgroundColor: c.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: c.divider,
      padding: 14,
      gap: 10,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.04,
      shadowRadius: 6,
      elevation: 2,
    }}>
      <ProductArt product={product} />
      <View style={{ gap: 4 }}>
        <T variant="caption" color={c.secondary} style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600' }}>
          {humanize(product.category)}
        </T>
        <T variant="strong" numberOfLines={2}>
          {product.name}
        </T>
      </View>
      <T variant="strong" color={c.accent} style={{ fontSize: 15, fontWeight: '700' }}>
        {product.variants.length ? `From ${money(Math.min(...product.variants.map(v => v.price_minor)))}` : 'Options unavailable'}
      </T>
      <View style={{ alignSelf: 'flex-start' }}>
        <Badge label={stocked ? 'Available' : 'Out of stock'} tone={stocked ? 'success' : 'warning'} />
      </View>
    </View>
  </Tap>;
}
