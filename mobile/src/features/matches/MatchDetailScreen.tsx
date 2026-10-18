import { RouteProp,useNavigation,useRoute } from '@react-navigation/native';
import { useEffect,useState } from 'react';
import { View } from 'react-native';
import { useApp } from '../../app/AppContext';
import { MatchScore } from '../../components/MatchScore';
import { Button,Chip,Empty,Message,Row,Screen,Section,Select,Sheet,T,dateLabel,money,ui } from '../../components/ui';
import type { AppNavigation,StackParams } from '../../navigation/routes';
import { colors as c } from '../../theme/tokens';
import { ProductArt } from '../store/components/ProductMedia';
import { MatchTimeline } from './components/MatchTimeline';
export function MatchDetailScreen() {
  const p = useApp();
  const n = useNavigation<AppNavigation>();
  const r = useRoute<RouteProp<StackParams, 'MatchDetail'>>();
  const match = p.data.fixtures.find(x => x.match_id === r.params?.matchId);
  const [tab, setTab] = useState('Overview');
  const [pin, setPin] = useState(false);
  const [product, setProduct] = useState<string>();
  const allowed = !!match && (p.role === 'super_admin' || p.role === 'league_organizer' && !!p.data.user?.league_ids?.includes(match.league_id));
  useEffect(() => {
    if (r.params?.matchId)
      return p.watchMatch(r.params.matchId);
  }, [r.params?.matchId]);
  return <Screen title="Match centre" back>
    {!match ? <Empty title="Match unavailable" body="Return to fixtures and refresh the schedule." /> : <>

      <View style={ui.wrap}>
        {['Overview', 'Timeline'].map(value => <Chip key={value} label={value === 'Timeline' ? `Timeline (${match.events?.length || 0})` : value} selected={tab === value} onPress={() => setTab(value)} />)}
      </View>

      {tab === 'Overview' ? <>
        <MatchScore match={match} />
        <Section title="Match information">
          <Row title="Competition" detail={p.data.leagues.find(x => x.league_id === match.league_id)?.name || match.league_id} />
          <Row title="Venue" detail={match.venue || 'To be confirmed'} />
          <Row title="Scheduled" detail={dateLabel(match.scheduled_at)} />
        </Section>

        <Section title="Featured by the club">
          {match.pinned_product ? <View style={{ gap: 12 }}>
            <ProductArt product={match.pinned_product} />
            <T variant="section">
              {match.pinned_product.name}
            </T>
            {match.pinned_product.variants.length > 0 && <T variant="strong" color={c.accent}>{`From ${(money(Math.min(...match.pinned_product.variants.map(v => v.price_minor))))}`}</T>}
            <Button label="Shop this product" onPress={() => n.navigate('ProductDetail', { productId: match.pinned_product!.product_id })} />
          </View> : <T color={c.secondary}>
            No product featured for this match.
          </T>}
        </Section>
        <Button label="Open match timeline" kind="secondary" onPress={() => setTab('Timeline')} />
      </> : <>
        <View style={{ backgroundColor: c.olive, padding: 16, borderRadius: 12, gap: 8 }}>
          <T variant="strong">{`${(match.home_name || match.home_team_id)} / ${(match.away_name || match.away_team_id)}`}</T>
          <T variant="heading">{`${(match.score.home ?? '-')} : ${(match.score.away ?? '-')}`}</T>
        </View>
        <MatchTimeline match={match} editable={allowed} />
      </>}

      {p.connection === 'offline' && <Message title="Saved match information" description="The confirmed score refreshes when you reconnect." tone="warning" />}

      {allowed && <Section title="Match tools">
        <Button label="Record match event" icon="score" onPress={() => n.navigate('ScoringEntry', { matchId: match.match_id })} />
        <Button label="Manage featured product" kind="secondary" onPress={() => setPin(true)} />
      </Section>}

      <Sheet title="Feature a product" open={pin} onClose={() => setPin(false)}>
        <Select label="Product" value={product} options={p.data.products.map(x => ({ value: x.product_id, label: x.name }))} onChange={setProduct} />
        <Button label="Pin product" disabled={!product || p.connection === 'offline'} onPress={() => void p.run({ kind: 'pin', matchId: match.match_id, productId: product }).then(result => {
          if (result.ok)
            setPin(false);
        })} />
        <Button label="Remove current pin" kind="secondary" disabled={!match.pinned_product || p.connection === 'offline'} onPress={() => void p.run({ kind: 'pin', matchId: match.match_id }).then(result => {
          if (result.ok)
            setPin(false);
        })} />
      </Sheet>

    </>}
  </Screen>;
}
