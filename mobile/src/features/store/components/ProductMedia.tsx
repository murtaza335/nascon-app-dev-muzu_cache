import { useState } from 'react';
import { Image,View } from 'react-native';
import { Icon } from '../../../components/Icon';
import { T } from '../../../components/ui';
import { colors as c } from '../../../theme/tokens';
import type { Product } from '../../../types/models';
export function ProductArt({ product, large = false }: {
  product?: Product;
  large?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  return product?.image_url && !failed ? <Image source={{ uri: product.image_url }} onError={() => setFailed(true)} accessibilityLabel={product.name} resizeMode="contain" style={{ width: '100%', height: large ? 240 : 112, backgroundColor: c.raised, borderRadius: 12 }} /> : <View style={{ height: large ? 220 : 112, backgroundColor: c.raised, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
    <Icon name="store" size={large ? 40 : 28} color={c.secondary} />
    <T variant="caption" color={c.secondary}>
      No image
    </T>
  </View>;
}
