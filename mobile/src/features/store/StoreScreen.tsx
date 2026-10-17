import { useState } from 'react';
import { Image, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../../app/AppContext';
import { Button, Chip, Empty, humanize, money, Screen, Skeleton, T, Tap, ui } from '../../components/ui';
import { Icon } from '../../components/Icon';
import type { AppNavigation } from '../../navigation/routes';
import type { Product } from '../../types/models';
import { colors as c } from '../../theme/tokens';
export function ProductArt({ product, large=false }: { product?:Product; large?:boolean }) {
  const [failed,setFailed]=useState(false);const [loaded,setLoaded]=useState(false);const height=large?220:140;
  return product?.image_url&&!failed?<View style={{height,borderRadius:16,overflow:'hidden'}}>{!loaded&&<Skeleton height={height} round={16} style={StyleSheet.absoluteFill}/>}<Image accessibilityLabel={product.name} source={{uri:product.image_url}} onLoad={()=>setLoaded(true)} onError={()=>setFailed(true)} resizeMode="cover" style={{width:'100%',height,opacity:loaded?1:0}}/></View>:<View style={{height:large?220:140,borderRadius:16,backgroundColor:c.surface,alignItems:'center',justifyContent:'center',gap:16}}><Icon name="store" size={large?64:40} color={c.outline}/><T variant="caption" color={c.secondary}>Club merchandise</T></View>;
}
export function StoreScreen() {
  const p=useApp();const n=useNavigation<AppNavigation>();const [category,setCategory]=useState('all');
  const categories=[...new Set(p.data.products.map(x=>x.category))]; const products=p.data.products.filter(x=>category==='all'||x.category===category);
  return <Screen title="Club store" stateful skeleton="products" action={<Button label={`Cart${p.cart.length?` (${p.cart.length})`:''}`} kind="quiet" onPress={()=>n.navigate('Cart')}/> }>
    <View style={{gap:12}}><Button label="Your orders" kind="quiet" onPress={()=>n.navigate('Orders')} style={{alignSelf:'flex-start'}}/></View>
    <ScrollView horizontal style={{flexGrow:0}} showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8}}><Chip label="All items" selected={category==='all'} onPress={()=>setCategory('all')}/>{categories.map(x=><Chip key={x} label={humanize(x)} selected={category===x} onPress={()=>setCategory(x)}/>)}</ScrollView>
    {products.length?<View style={{gap:28}}>{products.map(product=><Tap key={product.product_id} label={`View ${product.name}`} onPress={()=>n.navigate('ProductDetail',{productId:product.product_id})}><View style={{gap:12}}><ProductArt product={product}/><View style={ui.between}><View style={ui.grow}><T variant="strong">{product.name}</T><T variant="caption" color={c.secondary}>{humanize(product.category)}</T></View><T variant="strong" color={c.accent}>{product.variants.length?money(Math.min(...product.variants.map(x=>x.price_minor))):'Price TBC'}</T></View></View></Tap>)}</View>:<Empty title="No products available" body="Your club’s collection will appear here when products are available." icon="store" action={category!=='all'?'Show all items':'Refresh collection'} onAction={()=>{setCategory('all');if(!p.data.products.length)void p.refresh();}}/>}
  </Screen>;
}
