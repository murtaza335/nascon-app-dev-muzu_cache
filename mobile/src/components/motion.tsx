// NFR-ACC-01 / MOB UI states: animation, frosted overlay and loading primitives. Built on RN Animated only (no extra
// native module); every animation collapses to an instant change when the device asks for reduced motion.
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, DimensionValue, Easing, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { colors as c, motion, radius } from '../theme/tokens';

export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduced).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => sub.remove();
  }, []);
  return reduced;
}

/** Keeps an overlay mounted while it animates out; `progress` runs 0 → 1 on open and back on close. */
export function usePresence(open: boolean) {
  const [mounted, setMounted] = useState(open);
  const progress = useRef(new Animated.Value(open ? 1 : 0)).current;
  const reduced = useReducedMotion();
  useEffect(() => {
    if (open) setMounted(true);
    const animation = Animated.timing(progress, { toValue: open ? 1 : 0, duration: reduced ? 0 : open ? motion.enter : motion.exit, easing: open ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic), useNativeDriver: true });
    animation.start(({ finished }) => { if (finished && !open) setMounted(false); });
    return () => animation.stop();
  }, [open, reduced]);
  return { mounted, progress };
}

/**
 * Frosted backdrop: a dark scrim plus a translucent tinted veil, so the screen behind reads as softened and set back
 * rather than merely dimmed. (A true blur needs a native module, which we deliberately do not ship.)
 */
export function Frost({ progress, style }: { progress: Animated.Value | Animated.AnimatedInterpolation<number>; style?: StyleProp<ViewStyle> }) {
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: progress }, style]}>
    <View style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim }]} />
    <View style={[StyleSheet.absoluteFill, { backgroundColor: c.frost }]} />
  </Animated.View>;
}

/** One shared pulse so every skeleton on screen breathes in sync. */
function usePulse() {
  const value = useRef(new Animated.Value(0)).current; const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) { value.setValue(0.5); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(value, { toValue: 1, duration: motion.shimmer / 2, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(value, { toValue: 0, duration: motion.shimmer / 2, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    loop.start(); return () => loop.stop();
  }, [reduced]);
  return value;
}

export function Skeleton({ width = '100%', height = 16, round = 8, style }: { width?: DimensionValue; height?: number; round?: number; style?: StyleProp<ViewStyle> }) {
  const pulse = usePulse();
  return <View style={[{ width, height, borderRadius: round, backgroundColor: c.skeleton, overflow: 'hidden' }, style]}>
    <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: c.skeletonHighlight, opacity: pulse }]} />
  </View>;
}

export type SkeletonLayout = 'cards' | 'list' | 'table' | 'detail' | 'products' | 'profile';
const cardStyle = () => ({ backgroundColor: c.surface, padding: 20, borderRadius: radius.card, gap: 14 });
function SkeletonCard() {
  return <View style={cardStyle()}><View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Skeleton width={96} height={24} /><Skeleton width={110} height={14} /></View>
    {[0, 1].map(i => <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><Skeleton width={36} height={36} round={12} /><Skeleton width="55%" height={18} style={{ flex: 1 }} /><Skeleton width={28} height={24} /></View>)}
    <Skeleton width="40%" height={12} /></View>;
}
function SkeletonRow() {
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64 }}><Skeleton width={40} height={40} round={14} /><View style={{ flex: 1, gap: 8 }}><Skeleton width="60%" height={16} /><Skeleton width="35%" height={12} /></View></View>;
}
/** Placeholder that mirrors the real layout of a screen while its first data load is in flight. */
export function SkeletonScreen({ layout = 'cards' }: { layout?: SkeletonLayout }) {
  const body = (() => {
    switch (layout) {
      case 'list': return <View style={{ gap: 8 }}>{[0, 1, 2, 3, 4, 5].map(i => <SkeletonRow key={i} />)}</View>;
      case 'table': return <View style={{ gap: 18 }}><Skeleton height={20} width="100%" />{[0, 1, 2, 3, 4, 5].map(i => <View key={i} style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}><Skeleton width={20} height={18} /><Skeleton height={18} style={{ flex: 1 }} />{[0, 1, 2, 3].map(j => <Skeleton key={j} width={24} height={18} />)}</View>)}</View>;
      case 'products': return <View style={{ gap: 28 }}>{[0, 1, 2].map(i => <View key={i} style={{ gap: 12 }}><Skeleton height={140} round={16} /><View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><View style={{ gap: 8, flex: 1 }}><Skeleton width="55%" height={18} /><Skeleton width="30%" height={12} /></View><Skeleton width={80} height={18} /></View></View>)}</View>;
      case 'detail': return <View style={{ gap: 24 }}><View style={[cardStyle(), { paddingVertical: 28, alignItems: 'center' }]}><Skeleton width={110} height={22} /><View style={{ flexDirection: 'row', gap: 40 }}>{[0, 1].map(i => <View key={i} style={{ alignItems: 'center', gap: 12 }}><Skeleton width={52} height={52} round={18} /><Skeleton width={80} height={16} /><Skeleton width={40} height={44} /></View>)}</View></View>{[0, 1, 2].map(i => <SkeletonRow key={i} />)}</View>;
      case 'profile': return <View style={{ gap: 24 }}><View style={{ alignItems: 'center', gap: 14 }}><Skeleton width={76} height={76} round={24} /><Skeleton width="50%" height={26} /><Skeleton width="30%" height={14} /></View>{[0, 1, 2, 3].map(i => <SkeletonRow key={i} />)}</View>;
      default: return <View style={{ gap: 16 }}><Skeleton width="45%" height={22} />{[0, 1, 2].map(i => <SkeletonCard key={i} />)}</View>;
    }
  })();
  return <View accessible accessibilityRole="progressbar" accessibilityLabel="Loading information" accessibilityLiveRegion="polite" style={{ gap: 16 }}>{body}</View>;
}

/** Thin indeterminate bar for background work, so content stays readable while it refreshes. */
export function ProgressBar({ active, style }: { active: boolean; style?: StyleProp<ViewStyle> }) {
  const [width, setWidth] = useState(0); const x = useRef(new Animated.Value(0)).current; const reduced = useReducedMotion();
  const { mounted, progress } = usePresence(active);
  useEffect(() => {
    if (!active || !width) return;
    x.setValue(0);
    const loop = Animated.loop(Animated.timing(x, { toValue: 1, duration: reduced ? 2400 : 1200, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }));
    loop.start(); return () => loop.stop();
  }, [active, width, reduced]);
  if (!mounted) return <View style={[{ height: 3 }, style]} />;
  return <Animated.View accessibilityRole="progressbar" accessibilityLabel="Updating" onLayout={e => setWidth(e.nativeEvent.layout.width)} style={[{ height: 3, overflow: 'hidden', backgroundColor: c.olive, opacity: progress }, style]}>
    <Animated.View style={{ width: width * 0.4, height: 3, borderRadius: 2, backgroundColor: c.accent, transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [-width * 0.4, width] }) }] }} />
  </Animated.View>;
}

/** Card-style press feedback: a slight scale-down, as in platform list items. */
export function useScalePress() {
  const scale = useRef(new Animated.Value(1)).current; const reduced = useReducedMotion();
  const to = (value: number) => () => { if (!reduced) Animated.spring(scale, { toValue: value, speed: 40, bounciness: 0, useNativeDriver: true }).start(); };
  return { style: { transform: [{ scale }] }, onPressIn: to(0.98), onPressOut: to(1) };
}
