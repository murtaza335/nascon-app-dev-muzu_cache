import { ReactNode, useEffect, useState } from 'react';
import { ActivityIndicator, Animated, Image, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleProp, StyleSheet, Text, TextInput, TextInputProps, TextStyle, View, ViewStyle } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../app/AppContext';
import type { AppNavigation } from '../navigation/routes';
import { colors as c, elevation, motion, radius, type } from '../theme/tokens';
import { Icon, IconName } from './Icon';
import { Frost, ProgressBar, SkeletonLayout, SkeletonScreen, usePresence, useScalePress } from './motion';
export { ProgressBar, Skeleton, SkeletonScreen } from './motion';

const makeStyles = () => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 }, between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, grow: { flex: 1, minWidth: 0 },
  section: { gap: 16 }, divider: { height: 1, backgroundColor: c.divider },
  card: { backgroundColor: c.surface, padding: 20, borderRadius: radius.card, gap: 16 },
  inset: { padding: 16, borderRadius: 12, backgroundColor: c.raised, gap: 8 },
  text: { ...type.body, color: c.text }, secondary: { ...type.caption, color: c.secondary },
});
export const ui = new Proxy({} as ReturnType<typeof makeStyles>, { get: (_target, key: keyof ReturnType<typeof makeStyles>) => makeStyles()[key] });
export function T({ children, variant = 'body', color = c.text, style, ...props }: { children?: ReactNode; variant?: keyof typeof type; color?: string; style?: StyleProp<TextStyle> } & Omit<React.ComponentProps<typeof Text>, 'style'>) {
  return <Text {...props} style={[type[variant], { color }, style]}>{children}</Text>;
}
export function Button({ label, onPress, kind = 'primary', disabled, icon, busy, style }: { label: string; onPress: () => void; kind?: 'primary' | 'secondary' | 'quiet' | 'danger'; disabled?: boolean; icon?: IconName; busy?: boolean; style?: StyleProp<ViewStyle> }) {
  const app=useApp(); disabled=!!disabled||app.busy;
  const fg = kind === 'primary' ? c.onAccent : kind === 'danger' ? c.error : c.text;
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!disabled || !!busy, busy: !!busy }} disabled={disabled || busy} onPress={onPress}
    android_ripple={{ color: '#74806A44' }} style={({ pressed }) => [{ minHeight: 52, paddingHorizontal: 16, paddingVertical: 13, borderRadius: 12, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: kind === 'primary' ? c.accent : kind === 'secondary' ? c.raised : kind === 'danger' ? c.errorBg : 'transparent', opacity: disabled ? 0.45 : pressed ? 0.75 : 1 }, style]}>
    {busy ? <ActivityIndicator color={fg} /> : icon ? <Icon name={icon} color={fg} size={20} /> : null}<T variant="strong" color={fg} style={{ flexShrink: 1, textAlign: 'center' }}>{label}</T>
  </Pressable>;
}
export function IconButton({ name, label, onPress }: { name: IconName; label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} android_ripple={{ color: '#74806A44', borderless: true }} style={{ minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 24 }}><Icon name={name} color={c.text} /></Pressable>;
}
export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) { return <View style={[ui.card, style]}>{children}</View>; }
export function Section({ title, action, onAction, children }: { title: string; action?: string; onAction?: () => void; children: ReactNode }) {
  return <View style={ui.section}><View style={ui.between}><T variant="section" accessibilityRole="header" style={ui.grow}>{title}</T>{action && onAction ? <Button label={action} kind="quiet" onPress={onAction} /> : null}</View>{children}</View>;
}
export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected: !!selected }} onPress={onPress} style={({ pressed }) => ({ minHeight: 48, paddingHorizontal: 16, paddingVertical: 13, borderRadius: 20, backgroundColor: selected ? c.olive : c.surface, borderWidth: 1, borderColor: selected ? c.accent : c.divider, justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}><T variant="label" color={selected ? c.text : c.secondary}>{label}</T></Pressable>;
}
export type Tone = 'neutral' | 'success' | 'warning' | 'error' | 'info';
const toneColors = () => ({ neutral: [c.secondary, c.raised], success: [c.success, c.successBg], warning: [c.warning, c.warningBg], error: [c.error, c.errorBg], info: [c.info, c.infoBg] } as const);
export function Badge({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  const [fg, bg] = toneColors()[tone];
  return <View style={{ alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: bg }}><T variant="label" color={fg}>{label}</T></View>;
}
export function Message({ title, description, tone = 'info' }: { title: string; description?: string; tone?: Tone }) {
  const [fg, bg] = toneColors()[tone];
  return <View accessibilityLiveRegion="polite" style={{ backgroundColor: bg, borderRadius: 12, padding: 16, gap: 4 }}><T variant="strong" color={fg}>{title}</T>{!!description && <T variant="caption" color={fg}>{description}</T>}</View>;
}
export function Field({ label, error, helper, ...props }: TextInputProps & { label: string; error?: string; helper?: string }) {
  const [focused, setFocused] = useState(false);
  return <View style={{ gap: 8 }}><T variant="label">{label}</T><TextInput {...props} accessibilityLabel={label} placeholderTextColor={c.muted} selectionColor={c.accent} cursorColor={c.accent}
    onFocus={e => { setFocused(true); props.onFocus?.(e); }} onBlur={e => { setFocused(false); props.onBlur?.(e); }}
    style={[{ ...type.body, color: c.text, minHeight: 56, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 12, backgroundColor: c.surface, borderWidth: 1, borderColor: error ? c.error : focused ? c.accent : c.outline, textAlignVertical: props.multiline ? 'top' : 'center' }, props.style]} />
    {Boolean(error || helper) && <T variant="caption" color={error ? c.error : c.muted} accessibilityLiveRegion="polite">{error || helper}</T>}
  </View>;
}
export function Empty({ title, body, action, onAction, icon = 'fixtures' }: { title: string; body: string; action?: string; onAction?: () => void; icon?: IconName }) {
  return <View style={{ alignItems: 'center', gap: 12, paddingVertical: 32, paddingHorizontal: 16 }}><View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: c.raised, alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}><Icon name={icon} color={c.accent} size={28} /></View><T variant="section" style={{ textAlign: 'center' }}>{title}</T><T color={c.secondary} style={{ textAlign: 'center', maxWidth: 330 }}>{body}</T>{action && onAction && <Button label={action} kind="secondary" onPress={onAction} />}</View>;
}
export function Row({ title, detail, onPress, icon, trailing }: { title: string; detail?: string; onPress?: () => void; icon?: IconName; trailing?: ReactNode }) {
  const content = <View style={[ui.row, { minHeight: 64, paddingVertical: 12 }]}>{!!icon && <Icon name={icon} color={c.secondary} />}<View style={[ui.grow, { gap: 2 }]}><T variant="strong">{title}</T>{!!detail && <T variant="caption" color={c.secondary}>{detail}</T>}</View>{trailing || (onPress ? <Icon name="next" size={20} /> : null)}</View>;
  return onPress ? <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>{content}</Pressable> : content;
}
export function Avatar({ name, size = 44, uri }: { name?: string; size?: number; uri?: string | null }) {
  return uri ? <Image source={{ uri }} accessibilityLabel={name || 'Club logo'} style={{ width: size, height: size, borderRadius: size * 0.32 }} /> : <View accessible accessibilityLabel={name || 'Club identity'} style={{ width: size, height: size, borderRadius: size * 0.32, backgroundColor: c.raised, alignItems: 'center', justifyContent: 'center' }}><T variant={size >= 56 ? 'section' : 'label'} color={c.accent}>{name?.trim().split(/\s+/).slice(0, 2).map(x => x[0]).join('').toUpperCase() || 'NS'}</T></View>;
}
export function Metric({ value, label }: { value: string | number; label: string }) { return <View style={{ flex: 1, gap: 2, minWidth: 68 }}><T variant="title">{value}</T><T variant="caption" color={c.secondary}>{label}</T></View>; }
export function Select({ label, value, options, onChange, placeholder = 'Choose an option' }: { label: string; value?: string; options: { value: string; label: string }[]; onChange: (value: string) => void; placeholder?: string }) {
  const [open, setOpen] = useState(false);
  return <View style={{ gap: 8 }}><T variant="label">{label}</T><Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${options.find(x => x.value === value)?.label || placeholder}`} onPress={() => setOpen(true)} style={[ui.between, { minHeight: 56, padding: 14, borderRadius: 12, backgroundColor: c.surface, borderWidth: 1, borderColor: c.outline }]}><T color={value ? c.text : c.muted} style={ui.grow}>{options.find(x => x.value === value)?.label || placeholder}</T><Icon name="down" size={20} /></Pressable><Sheet title={label} open={open} onClose={() => setOpen(false)}>{options.length ? options.map(x => <Row key={x.value} title={x.label} onPress={() => { onChange(x.value); setOpen(false); }} trailing={value === x.value ? <Icon name="check" color={c.accent} /> : undefined} />) : <Empty title="No options available" body="There are no available choices for this selection." />}</Sheet></View>;
}
const shadow = (opacity: number, blur: number, y: number) => ({ shadowColor: '#000', shadowOpacity: opacity, shadowRadius: blur, shadowOffset: { width: 0, height: y } });
/** Bottom sheet: slides over a frosted backdrop on a raised surface with a hairline edge, grabber and shadow. */
export function Sheet({ title, open, onClose, children }: { title: string; open: boolean; onClose: () => void; children: ReactNode }) {
  const { mounted, progress } = usePresence(open);
  return <Modal visible={mounted} animationType="none" transparent statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}><View style={{ flex: 1, justifyContent: 'flex-end' }}>
    <Frost progress={progress} /><Pressable accessibilityLabel="Dismiss dialog" accessibilityRole="button" onPress={onClose} style={{ flex: 1 }} />
    <Animated.View style={{ maxHeight: '88%', transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [480, 0] }) }] }}><SafeAreaView edges={['bottom']} style={[{ maxHeight: '100%', backgroundColor: c.overlay, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, borderWidth: 1, borderBottomWidth: 0, borderColor: c.overlayEdge, elevation: elevation.sheet }, shadow(0.3, 24, -6)]}>
      <View style={{ alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: c.outline, marginTop: 10 }} />
      <View accessibilityViewIsModal style={{ paddingHorizontal: 20, paddingTop: 8, gap: 12, flexShrink: 1 }}><View style={ui.between}><T variant="section" accessibilityRole="header" style={ui.grow}>{title}</T><IconButton name="close" label={`Close ${title}`} onPress={onClose} /></View><View style={ui.divider} /><ScrollView keyboardShouldPersistTaps="handled" style={{ flexShrink: 1 }} contentContainerStyle={{ gap: 16, paddingBottom: 24 }}>{children}</ScrollView></View>
    </SafeAreaView></Animated.View>
  </View></Modal>;
}
/** Centered alert for short, consequential decisions; scales in over the frosted backdrop. */
export function Dialog({ title, body, open, onClose, children, tone = 'neutral' }: { title: string; body?: string; open: boolean; onClose: () => void; children?: ReactNode; tone?: Tone }) {
  const { mounted, progress } = usePresence(open); const [fg, bg] = toneColors()[tone];
  return <Modal visible={mounted} animationType="none" transparent statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}><View style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
    <Frost progress={progress} /><Pressable accessibilityLabel="Dismiss dialog" accessibilityRole="button" onPress={onClose} style={StyleSheet.absoluteFill} />
    <Animated.View accessibilityViewIsModal style={[{ backgroundColor: c.overlay, borderRadius: 24, borderWidth: 1, borderColor: c.overlayEdge, padding: 24, gap: 16, elevation: elevation.dialog, opacity: progress, transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }] }, shadow(0.35, 28, 10)]}>
      {tone !== 'neutral' && <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}><Icon name={tone === 'success' ? 'check' : tone === 'error' ? 'close' : 'clock'} color={fg} /></View>}
      <T variant="section" accessibilityRole="header">{title}</T>{!!body && <T color={c.secondary}>{body}</T>}{children}
    </Animated.View>
  </View></Modal>;
}
/** Snackbar on the inverse surface so it never blends into cards; slides up and auto-dismisses. */
export function Toast({ message, onDismiss, action, onAction, bottom = 88 }: { message: string | null; onDismiss: () => void; action?: string; onAction?: () => void; bottom?: number }) {
  const [shown, setShown] = useState(message); const { mounted, progress } = usePresence(!!message); const insets = useSafeAreaInsets();
  useEffect(() => { if (message) setShown(message); }, [message]);
  useEffect(() => { if (!message) return; const timer = setTimeout(onDismiss, action ? motion.toast * 1.6 : motion.toast); return () => clearTimeout(timer); }, [message, action]);
  if (!mounted || !shown) return null;
  return <Animated.View accessibilityLiveRegion="polite" accessibilityRole="alert" style={[{ position: 'absolute', left: 16, right: 16, bottom: Math.max(insets.bottom, 16) + bottom, flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: 16, paddingRight: 4, paddingVertical: 4, minHeight: 56, borderRadius: 14, backgroundColor: c.inverse, elevation: elevation.toast, opacity: progress, transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }] }, shadow(0.25, 12, 4)]}>
    <T color={c.onInverse} style={[ui.grow, { paddingVertical: 10 }]}>{shown}</T>
    {!!action && !!onAction && <Pressable accessibilityRole="button" accessibilityLabel={action} onPress={onAction} style={{ minHeight: 48, paddingHorizontal: 12, justifyContent: 'center' }}><T variant="strong" color={c.onInverse} style={{ textDecorationLine: 'underline' }}>{action}</T></Pressable>}
    <Pressable accessibilityRole="button" accessibilityLabel="Dismiss message" onPress={onDismiss} style={{ minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}><Icon name="close" color={c.onInverse} size={20} /></Pressable>
  </Animated.View>;
}
/**
 * Blocking overlay for user-started work that must not be interrupted (sign-in, checkout, saving). It appears only after
 * a short delay so fast actions never flash, and frosts the screen so it is obvious that input is paused.
 */
export function LoadingOverlay({ label }: { label: string | null }) {
  const [late, setLate] = useState(false); const [shown, setShown] = useState(label);
  useEffect(() => { if (!label) { setLate(false); return; } setShown(label); const timer = setTimeout(() => setLate(true), motion.overlayDelay); return () => clearTimeout(timer); }, [label]);
  const { mounted, progress } = usePresence(!!label && late);
  return <Modal visible={mounted} animationType="none" transparent statusBarTranslucent navigationBarTranslucent onRequestClose={() => {}}><View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
    <Frost progress={progress} />
    <Animated.View accessibilityLiveRegion="assertive" accessibilityViewIsModal style={[{ minWidth: 220, maxWidth: 320, alignItems: 'center', gap: 16, padding: 28, borderRadius: 24, backgroundColor: c.overlay, borderWidth: 1, borderColor: c.overlayEdge, elevation: elevation.dialog, opacity: progress, transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }] }, shadow(0.35, 28, 10)]}>
      <ActivityIndicator size="large" color={c.accent} accessibilityLabel={shown || 'Working'} /><T variant="strong" style={{ textAlign: 'center' }}>{shown}</T><T variant="caption" color={c.secondary} style={{ textAlign: 'center' }}>Please keep the app open.</T>
    </Animated.View>
  </View></Modal>;
}
/** Pressable card surface with scale feedback and a ripple. */
export function Tap({ children, onPress, label, style }: { children: ReactNode; onPress: () => void; label: string; style?: StyleProp<ViewStyle> }) {
  const press = useScalePress();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} onPressIn={press.onPressIn} onPressOut={press.onPressOut} android_ripple={{ color: '#74806A33', foreground: true }} style={[{ borderRadius: radius.card, overflow: 'hidden' }, style]}><Animated.View style={press.style}>{children}</Animated.View></Pressable>;
}
export function Screen({ title, subtitle, back = false, children, stateful = true, showStatus = true, action, skeleton = 'cards' }: { title: string; subtitle?: string; back?: boolean; children: ReactNode; stateful?: boolean; showStatus?: boolean; action?: ReactNode; skeleton?: SkeletonLayout }) {
  const n = useNavigation<AppNavigation>();
  const p = useApp();
  const loading = p.refreshing && !p.data.lastUpdated;
  return <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: c.background }}><View style={{ paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
    {back && <IconButton name="back" label="Go back" onPress={() => n.canGoBack() ? n.goBack() : p.session ? n.navigate('Main') : n.navigate('Login')} />}
    {!back && showStatus && p.data.tenant && <View style={{ borderLeftWidth: 3, borderLeftColor: /^#[0-9a-f]{6}$/i.test(p.data.tenant.colors?.primary || '') ? p.data.tenant.colors!.primary : c.accent, paddingLeft: 6 }}><Avatar name={p.data.tenant.name} uri={p.data.tenant.logo_url} size={32} /></View>}
    <View style={[ui.grow, { paddingLeft: back ? 0 : 8, gap: 2 }]}><T variant="title" accessibilityRole="header">{title}</T>{Boolean(subtitle || (!back && showStatus && p.data.tenant?.name)) && <T variant="caption" color={c.muted}>{subtitle || p.data.tenant?.name}</T>}</View>
    {action || (title !== 'Settings' && <IconButton name="settings" label="Open settings" onPress={() => n.navigate('Settings')} />)}
  </View>{showStatus && <Pressable accessibilityRole="button" accessibilityLabel={`${p.connection}. Open sync status`} onPress={() => n.navigate('SyncStatus')} style={[ui.between, { minHeight: 48, paddingHorizontal: 20, paddingVertical: 8, backgroundColor: p.connection === 'offline' ? c.warningBg : c.background }]}><View style={[ui.row, ui.grow]}><View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: p.connection === 'offline' ? c.warning : c.accent }} /><T variant="label" color={p.connection === 'offline' ? c.warning : c.secondary} style={ui.grow}>{p.connection === 'offline' ? 'Offline · Saved on device' : p.connection === 'syncing' ? 'Syncing pending work' : 'Online · Up to date'}</T></View><Icon name="next" size={18} /></Pressable>}
    <ProgressBar active={p.refreshing && !loading} />
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView refreshControl={<RefreshControl refreshing={p.refreshing} onRefresh={()=>void p.refresh()} tintColor={c.accent} colors={[c.accent]} />} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets contentContainerStyle={{ padding: 16, gap: 24, flexGrow: 1, paddingBottom: 40 }}>
      {Boolean(p.resourceError) && <><Message title="Refresh failed" description={p.resourceError} tone="error"/><Button label="Retry refresh" kind="secondary" onPress={()=>void p.refresh()}/></>}
      {stateful && loading ? <SkeletonScreen layout={skeleton} /> : children}

    </ScrollView></KeyboardAvoidingView></SafeAreaView>;
}
export function money(minor: number, currency = 'PKR') { return `${currency} ${(minor / 100).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
export function humanize(value: string) { return value.replace(/_/g, ' ').replace(/^./, x => x.toUpperCase()); }
export function dateLabel(value?: string | null) { if (!value) return 'Time to be confirmed'; const d = new Date(value); return Number.isNaN(d.valueOf()) ? 'Time to be confirmed' : d.toLocaleString('en-PK', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }); }
