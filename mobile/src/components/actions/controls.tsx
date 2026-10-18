import { ReactNode } from 'react';
import { ActivityIndicator,Pressable,StyleProp,ViewStyle } from 'react-native';
import { useApp } from '../../app/AppContext';
import { colors as c,radius,space } from '../../theme/tokens';
import { Icon,IconName } from '../Icon';
import { T } from '../display/primitives';
export function Button({ label, onPress, kind = 'primary', disabled, busy, icon, style, onDark = false }: {
  label: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary' | 'quiet' | 'danger';
  disabled?: boolean;
  busy?: boolean;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
  onDark?: boolean;
}) {
  const p = useApp();
  const inactive = !!disabled || !!busy || p.busy;
  const foreground = inactive ? (onDark ? c.darkMuted : c.muted) : kind === 'primary' ? c.onAccent : kind === 'danger' ? c.error : onDark ? c.onDarkSurface : c.accent;
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: inactive, busy: !!busy }} disabled={inactive} onPress={onPress} android_ripple={{ color: c.divider }} style={({ pressed }) => [{ minHeight: 52, paddingHorizontal: space.xl, paddingVertical: 14, borderRadius: radius.field, backgroundColor: inactive ? (onDark ? c.darkRaised : c.raised) : kind === 'primary' ? c.accent : kind === 'secondary' ? (onDark ? c.darkRaised : c.olive) : kind === 'danger' ? c.errorBg : 'transparent', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: space.sm, opacity: !inactive && pressed ? 0.75 : 1 }, style]}>

    {busy ? <ActivityIndicator color={foreground} /> : icon ? <Icon name={icon} color={foreground} size={20} /> : null}

    <T variant="strong" color={foreground} style={{ flexShrink: 1, textAlign: 'center' }}>

      {label}

    </T>

  </Pressable>;
}
export function IconButton({ name, label, onPress, color = c.text }: {
  name: IconName;
  color?: string;
  label: string;
  onPress: () => void;
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} android_ripple={{ color: c.divider, borderless: true }} style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 24 }}>

    <Icon name={name} color={color} />

  </Pressable>;
}
export function Chip({ label, selected, onPress }: {
  label: string;
  selected?: boolean;
  onPress: () => void;
}) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected: !!selected }} onPress={onPress} style={({ pressed }) => ({ minHeight: 48, paddingHorizontal: space.lg, paddingVertical: 13, borderRadius: 12, backgroundColor: selected ? c.accent : c.surface, justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}>

    <T variant="label" color={selected ? c.onAccent : c.secondary}>

      {label}

    </T>

  </Pressable>;
}
export function Tap({ children, onPress, label, style }: {
  children: ReactNode;
  onPress: () => void;
  label: string;
  style?: StyleProp<ViewStyle>;
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} android_ripple={{ color: c.divider }} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }, style]}>

    {children}

  </Pressable>;
}
