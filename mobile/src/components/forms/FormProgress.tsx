import { View } from 'react-native';
import { colors as c } from '../../theme/tokens';
import { T } from '../display/primitives';
export function FormProgress({ labels, step }: {
  labels: string[];
  step: number;
}) {
  return <View accessibilityLabel={`Step ${step + 1} of ${labels.length}: ${labels[step]}`} style={{ gap: 12 }}>
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {labels.map((label, index) => <View key={label} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: index <= step ? c.accent : c.divider }} />)}
    </View>
    <T variant="label" color={c.accent}>{`Step ${step + 1} of ${labels.length} / ${labels[step]}`}</T>
  </View>;
}
