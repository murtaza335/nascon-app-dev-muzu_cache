import { ReactNode } from 'react';
import { Image,Pressable,StyleProp,StyleSheet,Text,TextStyle,View,ViewStyle } from 'react-native';
import { colors as c,radius,space,type } from '../../theme/tokens';
import { Icon,IconName } from '../Icon';
const styles = () => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md }, between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md }, wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }, grow: { flex: 1, minWidth: 0 },
  section: { gap: 12 }, divider: { height: 1, backgroundColor: c.divider },
  card: { backgroundColor: c.surface, padding: space.xl, borderRadius: radius.card, borderWidth: 1, borderColor: c.divider, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2, gap: space.lg },
  inset: { padding: space.lg, borderRadius: radius.field, backgroundColor: c.raised, borderWidth: 1, borderColor: c.divider, gap: space.sm },
  text: { ...type.body, color: c.text }, secondary: { ...type.caption, color: c.secondary }
});
export const ui = new Proxy({} as ReturnType<typeof styles>, { get: (_, key: keyof ReturnType<typeof styles>) => styles()[key] });
export function T({ children, variant = 'body', color = c.text, style, ...props }: {
  children?: ReactNode;
  variant?: keyof typeof type;
  color?: string;
  style?: StyleProp<TextStyle>;
} & Omit<React.ComponentProps<typeof Text>, 'style'>) {
  return <Text {...props} style={[type[variant], { color }, style]}>

    {children}

  </Text>;
}
export function Card({ children, style }: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[ui.card, style]}>

    {children}

  </View>;
}
export function Row({ title, detail, onPress, icon, trailing }: {
  title: string;
  detail?: string;
  onPress?: () => void;
  icon?: IconName;
  trailing?: ReactNode;
}) {
  const content = <View style={[ui.row, { minHeight: 68, paddingVertical: space.lg, borderBottomWidth: 1, borderColor: c.divider }]}>

    {icon && <Icon name={icon} color={c.secondary} />}

    <View style={[ui.grow, { gap: space.xs }]}>

      <T variant="strong">

        {title}

      </T>

      {!!detail && <T variant="caption" color={c.secondary}>

        {detail}

      </T>}

    </View>

    {trailing || (onPress ? <Icon name="next" size={20} /> : null)}

  </View>;
  return onPress ? <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>

    {content}

  </Pressable> : content;
}
export function Avatar({ name, size = 44, uri, background = c.olive, color = c.accent }: {
  name?: string;
  size?: number;
  uri?: string | null;
  background?: string;
  color?: string;
}) {
  return uri ? <Image source={{ uri }} accessibilityLabel={name || 'Club logo'} style={{ width: size, height: size, borderRadius: size / 4 }} /> : <View accessible accessibilityLabel={name || 'Club'} style={{ width: size, height: size, borderRadius: size / 4, backgroundColor: background, alignItems: 'center', justifyContent: 'center' }}>

    <T variant={size > 50 ? 'section' : 'label'} color={color}>

      {name === 'Sportron' ? 'SP' : name?.trim().split(/\s+/).slice(0, 2).map(x => x[0]).join('').toUpperCase() || 'SP'}

    </T>

  </View>;
}
export function Metric({ value, label }: {
  value: string | number;
  label: string;
}) {
  return <View style={{ flex: 1, minWidth: 64, gap: space.xs }}>

    <T variant="title" style={{ fontVariant: ['tabular-nums'] }}>

      {value}

    </T>

    <T variant="caption" color={c.secondary}>

      {label}

    </T>

  </View>;
}
export function money(minor: number, currency = 'PKR') {
  return `${currency} ${(minor / 100).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
export function humanize(value: string) {
  return value.replace(/_/g, ' ').replace(/^./, x => x.toUpperCase());
}
export function dateLabel(value?: string | null) {
  if (!value)
    return 'Time to be confirmed';
  const d = new Date(value);
  return Number.isNaN(d.valueOf()) ? 'Time to be confirmed' : d.toLocaleString('en-PK', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });
}
