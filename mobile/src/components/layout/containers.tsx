import { useNavigation,useRoute } from '@react-navigation/native';
import { cloneElement, isValidElement, ReactElement, ReactNode } from 'react';
import { KeyboardAvoidingView,Modal,Platform,Pressable,RefreshControl,ScrollView,View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../../app/AppContext';
import type { AppNavigation } from '../../navigation/routes';
import { colors as c,space } from '../../theme/tokens';
import { Icon } from '../Icon';
import { IconButton } from '../actions/controls';
import { Avatar,T,ui } from '../display/primitives';
import { ProgressBar,RefreshNotice,SkeletonScreen,Tone } from '../feedback/states';
export function Section({ title, action, onAction, children }: {
  title: string; action?: string; onAction?: () => void; children: ReactNode;
}) {
  return (
    <View style={ui.section}>
      <View style={[ui.between, { gap: 8, marginBottom: 2 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
          <View style={{ width: 3.5, height: 18, borderRadius: 2, backgroundColor: c.accent }} />
          <T variant="section" accessibilityRole="header" style={ui.grow}>{title}</T>
        </View>
        {action && onAction && (
          <Pressable accessibilityRole="button" accessibilityLabel={action} onPress={onAction}
            style={{ minHeight: 48, justifyContent: 'center', paddingHorizontal: 8 }}>
            <T variant="label" color={c.accent} style={{ fontWeight: '700' }}>{action}</T>
          </Pressable>
        )}
      </View>
      {children}
    </View>
  );
}
export function Sheet({ title, open, onClose, children }: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  return <Modal visible={open} transparent animationType="none" onRequestClose={onClose}>

    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.scrim, justifyContent: 'flex-end' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

      <Pressable accessibilityRole="button" accessibilityLabel="Dismiss dialog" onPress={onClose} style={{ flex: 1 }} />

      <SafeAreaView edges={['bottom']} style={{ maxHeight: '88%', backgroundColor: c.overlay, borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>

        <View accessibilityViewIsModal style={{ padding: space.xl, gap: space.lg, flexShrink: 1 }}>

          <View style={ui.between}>

            <T variant="section" accessibilityRole="header" style={ui.grow}>

              {title}

            </T>

            <IconButton name="close" label={`Close ${title}`} onPress={onClose} />

          </View>

          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: space.lg, paddingBottom: space.lg }}>

            {children}

          </ScrollView>

        </View>

      </SafeAreaView>

    </KeyboardAvoidingView>

  </Modal>;
}
export function Dialog({ title, body, open, onClose, children }: {
  title: string;
  body?: string;
  open: boolean;
  onClose: () => void;
  children?: ReactNode;
  tone?: Tone;
}) {
  return <Sheet title={title} open={open} onClose={onClose}>

    {!!body && <T>

      {body}

    </T>}

    {children}

  </Sheet>;
}
export function Screen({ title, subtitle, back = false, children, stateful = true, showStatus = true, action, footer, skeleton = 'cards' }: {
  title: string; subtitle?: string; back?: boolean; children: ReactNode;
  stateful?: boolean; showStatus?: boolean; action?: ReactNode; footer?: ReactNode; skeleton?: string;
}) {
  const p = useApp();
  const n = useNavigation<AppNavigation>();
  const currentRoute = useRoute();
  const loading = p.refreshing && !p.data.lastUpdated;
  const tenantColor = /^#[0-9a-f]{6}$/i.test(p.data.tenant?.colors?.primary || '') ? p.data.tenant!.colors!.primary : c.darkMuted;
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: c.darkSurface }}>
      <View style={{ backgroundColor: c.darkSurface, overflow: 'hidden', position: 'relative', borderBottomLeftRadius: 18, borderBottomRightRadius: 18 }}>
        {/* Subtle topographic contour overlay */}
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} pointerEvents="none">
          <View style={{ position: 'absolute', width: 280, height: 180, top: -70, right: -40, borderRadius: 120, borderWidth: 1.2, borderColor: 'rgba(255,255,255,0.05)', transform: [{ rotate: '25deg' }] }} />
          <View style={{ position: 'absolute', width: 220, height: 140, top: -40, right: -20, borderRadius: 90, borderWidth: 1.2, borderColor: 'rgba(255,255,255,0.07)', transform: [{ rotate: '20deg' }] }} />
          <View style={{ position: 'absolute', width: 260, height: 160, top: -30, left: -60, borderRadius: 100, borderWidth: 1.2, borderColor: 'rgba(255,255,255,0.05)', transform: [{ rotate: '-15deg' }] }} />
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 64, paddingHorizontal: back ? 8 : 20, gap: 10 }}>
          {back && <IconButton name="back" label="Go back" color={c.onDarkSurface}
            onPress={() => n.canGoBack() ? n.goBack() : n.navigate(p.session ? 'Main' : 'Login')} />}
          {p.session && showStatus && !back && <Avatar name={p.data.tenant?.name} uri={p.data.tenant?.logo_url}
            size={32} background={c.darkRaised} color={c.onDarkSurface} />}
          <View style={{ flex: 1, minWidth: 0, paddingVertical: 8, gap: 3 }}>
            <T variant="title" color={c.onDarkSurface} accessibilityRole="header" style={{ fontWeight: '700', letterSpacing: -0.3 }}>
              {currentRoute.name === 'Home' ? 'Sportron' : title}
            </T>
            {p.session && showStatus ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: tenantColor }} />
                <T variant="caption" color={c.darkMuted} numberOfLines={1} style={{ fontSize: 12, fontWeight: '500' }}>
                  {p.data.tenant?.name || 'Sportron'}
                </T>
              </View>
            ) : !!subtitle && <T variant="caption" color={c.darkMuted}>{subtitle}</T>}
          </View>
          {isValidElement(action) ? cloneElement(action as ReactElement<{ onDark?: boolean }>, { onDark: true }) : action}
          {p.session ? currentRoute.name !== 'Account' && <IconButton name="person" label="Open account" color={c.onDarkSurface}
            onPress={() => n.navigate('Account')} /> : !action && title !== 'Settings' ? <IconButton name="settings" label="Open settings"
              color={c.onDarkSurface} onPress={() => n.navigate('Settings')} /> : null}
        </View>

        {showStatus && p.session && (
          <Pressable accessibilityRole="button" accessibilityLabel={`${p.connection}, ${p.pendingCount} pending actions. Open sync status`}
            onPress={() => n.navigate('SyncStatus')} style={{ minHeight: 44, marginHorizontal: 16, marginBottom: 12, paddingHorizontal: 14, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 8,
              borderRadius: 12, borderWidth: 1, borderColor: p.connection === 'offline' ? c.warning : 'rgba(255,255,255,0.12)',
              backgroundColor: p.connection === 'offline' ? c.warningBg : 'rgba(0,0,0,0.2)' }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: p.connection === 'offline' ? c.warning : p.connection === 'syncing' ? c.info : '#86EFAC' }} />
            <Icon name={p.connection === 'offline' ? 'wifi' : 'sync'} size={15} color={p.connection === 'offline' ? c.warning : c.darkMuted} />
            <T variant="caption" color={p.connection === 'offline' ? c.warning : c.darkMuted} style={[ui.grow, { fontSize: 13 }]}>
              {p.connection === 'offline' ? 'Offline - saved information' : p.connection === 'syncing' ? 'Syncing work' : p.refreshing ? 'Refreshing' : p.resourceError ? 'Connected - refresh failed' : 'Connected'}{p.pendingCount ? ` / ${p.pendingCount} pending` : ''}
            </T>
            <Icon name="next" size={14} color={p.connection === 'offline' ? c.warning : c.darkMuted} />
          </Pressable>
        )}
      </View>
      <ProgressBar active={p.refreshing && !loading} />
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets
          refreshControl={p.session ? <RefreshControl refreshing={p.refreshing} onRefresh={() => void p.refresh()} tintColor={c.accent} colors={[c.accent]} /> : undefined}
          contentContainerStyle={{ padding: 20, gap: 24, paddingBottom: 40, flexGrow: 1, width: '100%', maxWidth: 760, alignSelf: 'center' }}>
          {stateful && !!p.resourceError && <RefreshNotice message={p.resourceError} onRetry={() => void p.refresh()} />}
          {stateful && loading ? <SkeletonScreen layout={skeleton} /> : children}
        </ScrollView>
      </KeyboardAvoidingView>
      {!!footer && <SafeAreaView edges={['bottom']} style={{ backgroundColor: c.surface, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12,
        borderTopWidth: 1, borderColor: c.divider }}>{footer}</SafeAreaView>}
    </SafeAreaView>
  );
}
