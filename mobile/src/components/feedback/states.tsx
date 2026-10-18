import { useEffect,useState } from 'react';
import { ActivityIndicator,Modal,Pressable,StyleProp,View,ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors as c,space } from '../../theme/tokens';
import { Icon,IconName } from '../Icon';
import { Button } from '../actions/controls';
import { T,ui } from '../display/primitives';
export type Tone = 'neutral' | 'success' | 'warning' | 'error' | 'info';
const tones = () => ({ neutral: [c.secondary, c.raised], success: [c.success, c.successBg], warning: [c.warning, c.warningBg], error: [c.error, c.errorBg], info: [c.info, c.infoBg] } as const);
export function Badge({ label, tone = 'neutral' }: {
  label: string;
  tone?: Tone;
}) {
  const [fg, bg] = tones()[tone];
  return <View style={{ alignSelf: 'flex-start', backgroundColor: bg, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 }}>

    <T variant="label" color={fg}>

      {label}

    </T>

  </View>;
}
export function Message({ title, description, tone = 'info' }: {
  title: string;
  description?: string;
  tone?: Tone;
}) {
  const [fg, bg] = tones()[tone];
  return <View accessibilityLiveRegion="polite" style={{ backgroundColor: bg, padding: space.lg, borderRadius: 12, gap: space.xs }}>

    <T variant="strong" color={fg}>

      {title}

    </T>

    {!!description && <T variant="caption" color={fg}>

      {description}

    </T>}

  </View>;
}
export function Empty({ title, body, action, onAction, icon = 'fixtures' }: {
  title: string;
  body: string;
  action?: string;
  onAction?: () => void;
  icon?: IconName;
}) {
  return <View style={{ paddingVertical: space.xxl, gap: space.lg, alignItems: 'flex-start' }}>

    <Icon name={icon} color={c.accent} size={32} />

    <T variant="section">

      {title}

    </T>

    <T color={c.secondary} style={{ maxWidth: 440 }}>

      {body}

    </T>

    {action && onAction && <Button label={action} kind="secondary" onPress={onAction} />}

  </View>;
}
export function ProgressBar({ active, style }: {
  active: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return active ? <View style={[{ height: 3, backgroundColor: c.olive }, style]}>

    <View style={{ height: 3, width: '45%', backgroundColor: c.accent }} />

  </View> : null;
}
export function SkeletonScreen({ layout }: {
  layout?: string;
}) {
  return <View accessibilityLabel="Loading information" accessibilityRole="progressbar" style={{ gap: space.lg, paddingVertical: space.lg }}>

    <ActivityIndicator color={c.accent} />

    <T color={c.secondary}>{`Loading ${(layout === 'table' ? 'standings' : 'your workspace')} …`}</T>

    {[90, 140, 90].map((h, i) => <View key={i} style={{ height: h, borderRadius: 12, backgroundColor: c.skeleton }} />)}

  </View>;
}
export function Toast({ message, onDismiss, action, onAction, bottom = 88 }: {
  message: string | null;
  onDismiss: () => void;
  action?: string;
  onAction?: () => void;
  bottom?: number;
}) {
  const insets = useSafeAreaInsets();
  useEffect(() => {
    if (!message)
      return;
    const timer = setTimeout(onDismiss, 8000);
    return () => clearTimeout(timer);
  }, [message]);
  return message ? <View accessibilityLiveRegion="polite" accessibilityRole="alert" style={{ position: 'absolute', bottom: Math.max(insets.bottom, 16) + bottom, left: 16, right: 16, backgroundColor: c.inverse, borderRadius: 12, paddingLeft: 16, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 8, elevation: 6 }}>

    <T color={c.onInverse} style={ui.grow}>

      {message}

    </T>

    {action && onAction && <Pressable accessibilityRole="button" onPress={onAction} style={{ minHeight: 48, padding: 12, justifyContent: 'center' }}>

      <T color={c.onInverse} variant="strong">

        {action}

      </T>

    </Pressable>}

    <Pressable accessibilityRole="button" accessibilityLabel="Dismiss message" onPress={onDismiss} style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}>

      <Icon name="close" color={c.onInverse} />

    </Pressable>

  </View> : null;
}
export function LoadingOverlay({ label }: {
  label: string | null;
}) {
  return <Modal visible={!!label} transparent animationType="none" onRequestClose={() => {
  }}>

    <View style={{ flex: 1, backgroundColor: c.scrim, alignItems: 'center', justifyContent: 'center', padding: 24 }}>

      <View accessibilityViewIsModal accessibilityLiveRegion="polite" style={{ backgroundColor: c.overlay, padding: 32, borderRadius: 16, gap: 24, maxWidth: 340, alignItems: 'center' }}>

        <ActivityIndicator size="large" color={c.accent} />

        <T variant="strong" style={{ textAlign: 'center' }}>

          {label}

        </T>

      </View>

    </View>

  </Modal>;
}
export function RefreshNotice({ message, onRetry }: {
  message: string;
  onRetry: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  return <View style={{ backgroundColor: c.surface, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 4, gap: 4 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Pressable accessibilityRole="button" accessibilityLabel={expanded ? 'Hide refresh details' : 'Show refresh details'} accessibilityState={{ expanded }} onPress={() => setExpanded(!expanded)} style={{ flex: 1, minHeight: 48, justifyContent: 'center' }}>
        <T variant="label" color={c.error}>
          Refresh unavailable
        </T>
        <T variant="caption" color={c.secondary}>
          {expanded ? 'Hide details' : 'Show details'}
        </T>
      </Pressable>
      <Button label="Retry" kind="quiet" onPress={onRetry} style={{ paddingHorizontal: 12, minHeight: 48 }} />
    </View>
    {expanded && <T variant="caption" color={c.secondary} style={{ paddingBottom: 12 }}>
      {message}
    </T>}
  </View>;
}
