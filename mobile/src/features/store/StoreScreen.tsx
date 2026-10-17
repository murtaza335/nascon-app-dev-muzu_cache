import { useState } from 'react';
import { Image, Pressable, ScrollView, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { usePreview } from '../../app/PreviewContext';
import { Button, Chip, Empty, humanize, money, Screen, T, ui } from '../../components/ui';
import { Icon } from '../../components/Icon';
import type { AppNavigation } from '../../navigation/routes';
import type { Product } from '../../types/preview';
import { colors as c } from '../../theme/tokens';
export function ProductArt({ product, large=false }: { product?:Product; large?:boolean }) {
  const [failed,setFailed]=useState(false);
  return product?.image_url&&!failed?<Image accessibilityLabel={product.name} source={{uri:product.image_url}} onError={()=>setFailed(true)} resizeMode="cover" style={{width:'100%',height:large?260:180,borderRadius:16,backgroundColor:c.raised}}/>:<View style={{height:large?260:180,borderRadius:16,backgroundColor:c.olive,alignItems:'center',justifyContent:'center',gap:16}}><Icon name="store" size={large?64:40} color={c.outline}/><T variant="caption" color={c.secondary}>Club merchandise</T></View>;
}
export function StoreScreen() {
  const p=usePreview();const n=useNavigation<AppNavigation>();const [category,setCategory]=useState('all');
  const categories=[...new Set(p.data.products.map(x=>x.category))]; const products=p.data.products.filter(x=>category==='all'||x.category===category);
  return <Screen title="Club store" subtitle="Wear your belonging" stateful action={<Button label={`Cart${p.cart.length?` (${p.cart.length})`:''}`} kind="quiet" onPress={()=>n.navigate('Cart')}/> }>
    <View style={{gap:12}}><T variant="heading">Part of the club.</T><T color={c.secondary}>Find something that brings your team a little closer.</T><Button label="Your orders" kind="quiet" onPress={()=>n.navigate('Orders')} style={{alignSelf:'flex-start'}}/></View>
    <ScrollView horizontal style={{flexGrow:0}} showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8}}><Chip label="All items" selected={category==='all'} onPress={()=>setCategory('all')}/>{categories.map(x=><Chip key={x} label={humanize(x)} selected={category===x} onPress={()=>setCategory(x)}/>)}</ScrollView>
    {products.length?<View style={{gap:28}}>{products.map(product=><Pressable key={product.product_id} accessibilityRole="button" accessibilityLabel={`View ${product.name}`} onPress={()=>n.navigate('ProductDetail',{productId:product.product_id})} style={{gap:12}}><ProductArt product={product}/><View style={ui.between}><View style={ui.grow}><T variant="strong">{product.name}</T><T variant="caption" color={c.secondary}>{humanize(product.category)}</T></View><T variant="strong" color={c.accent}>{product.variants.length?money(Math.min(...product.variants.map(x=>x.price_minor))):'Price TBC'}</T></View></Pressable>)}</View>:<Empty title="Something worth wearing" body="Your club’s collection will appear here when products are available." icon="store" action={category!=='all'?'Show all items':'Refresh collection'} onAction={()=>{setCategory('all');if(!p.data.products.length)p.notify('No products are available yet.');}}/>}
  </Screen>;
}
