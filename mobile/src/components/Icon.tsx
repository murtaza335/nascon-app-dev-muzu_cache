import { View } from 'react-native';
import { colors } from '../theme/tokens';
export type IconName = 'home' | 'fixtures' | 'standings' | 'store' | 'person' | 'roster' | 'score' | 'back' | 'next' | 'down' | 'close' | 'plus' | 'minus' | 'check' | 'settings' | 'sync' | 'wifi' | 'clock' | 'mail' | 'lock' | 'eye' | 'eye-off';
/** Small, consistent line icons drawn with native geometry; no font/icon package. */
export function Icon({ name, color = colors.secondary, size = 24 }: {
  name: IconName;
  color?: string;
  size?: number;
}) {
  const stroke = { borderColor: color, borderWidth: 1.8 };
  const line = (key: string, left: number, top: number, width: number, rotation = '0deg') => <View key={key} style={{ position: 'absolute', left, top, width, height: 1.8, borderRadius: 1, backgroundColor: color, transform: [{ rotate: rotation }] }} />;
  let shapes;
  switch (name) {
    case 'home':
      shapes = <>
        <View style={{ position: 'absolute', left: 5, top: 9, width: 15, height: 12, borderWidth: 1.8, borderColor: color, borderRadius: 2 }} />
        {line('roof1', 2, 7, 13, '-40deg')}
        {line('roof2', 11, 7, 13, '40deg')}
        <View style={{ position: 'absolute', left: 10, top: 15, width: 5, height: 6, borderWidth: 1.8, borderColor: color }} />
      </>;
      break;
    case 'back':
    case 'next':
    case 'down':
      shapes = <View style={{ position: 'absolute', left: 8, top: 6, width: 10, height: 10, borderLeftWidth: 1.8, borderBottomWidth: 1.8, borderColor: color, transform: [{ rotate: name === 'back' ? '45deg' : name === 'next' ? '225deg' : '-45deg' }] }} />;
      break;
    case 'close':
      shapes = [line('a', 3, 11, 18, '45deg'), line('b', 3, 11, 18, '-45deg')];
      break;
    case 'plus':
      shapes = [line('a', 4, 11, 16), line('b', 4, 11, 16, '90deg')];
      break;
    case 'minus':
      shapes = line('a', 4, 11, 16);
      break;
    case 'check':
      shapes = [line('a', 3, 13, 7, '45deg'), line('b', 7, 10, 14, '-45deg')];
      break;
    case 'standings':
      shapes = [4, 10, 16].map((x, i) => <View key={x} style={{ position: 'absolute', left: x, bottom: 3, width: 3, height: 8 + i * 5, borderRadius: 1, backgroundColor: color }} />);
      break;
    case 'person':
    case 'roster':
      shapes = <>

        <View style={[stroke, { position: 'absolute', left: 8, top: 2, width: 9, height: 9, borderRadius: 5 }]} />

        <View style={[stroke, { position: 'absolute', left: 4, top: 14, width: 17, height: 8, borderTopLeftRadius: 9, borderTopRightRadius: 9 }]} />

        {name === 'roster' && line('extra', 19, 5, 5)}

      </>;
      break;
    case 'clock':
    case 'settings':
    case 'sync':
    case 'wifi':
      shapes = <>

        <View style={[stroke, { position: 'absolute', left: 3, top: 3, width: 18, height: 18, borderRadius: 10 }]} />

        {name === 'clock' ? <>

          {line('a', 11, 8, 6, '90deg')}

          {line('b', 11, 12, 5)}

        </> : <View style={[stroke, { position: 'absolute', left: 9, top: 9, width: 6, height: 6, borderRadius: 4 }]} />}

      </>;
      break;
    case 'store':
      shapes = <>

        <View style={[stroke, { position: 'absolute', left: 4, top: 7, width: 17, height: 15, borderRadius: 3 }]} />

        <View style={[stroke, { position: 'absolute', left: 8, top: 2, width: 9, height: 10, borderRadius: 5 }]} />

      </>;
      break;
    case 'score':
      shapes = <>

        <View style={[stroke, { position: 'absolute', left: 2, top: 4, width: 21, height: 16, borderRadius: 4 }]} />

        {line('a', 9, 11, 7, '90deg')}

        {line('b', 5, 11, 3)}

        {line('c', 17, 11, 3)}

      </>;
      break;
    case 'mail':
      shapes = <>
        <View style={[stroke, { position: 'absolute', left: 2, top: 5, width: 20, height: 14, borderRadius: 3 }]} />
        {line('flap1', 3, 7, 10, '30deg')}
        {line('flap2', 11, 7, 10, '-30deg')}
      </>;
      break;
    case 'lock':
      shapes = <>
        <View style={[stroke, { position: 'absolute', left: 6, top: 3, width: 12, height: 10, borderTopLeftRadius: 6, borderTopRightRadius: 6, borderBottomWidth: 0 }]} />
        <View style={[stroke, { position: 'absolute', left: 4, top: 11, width: 16, height: 11, borderRadius: 3 }]} />
        <View style={{ position: 'absolute', left: 11, top: 14, width: 2, height: 4, borderRadius: 1, backgroundColor: color }} />
      </>;
      break;
    case 'eye':
      shapes = <>
        <View style={[stroke, { position: 'absolute', left: 2, top: 7, width: 20, height: 10, borderRadius: 8 }]} />
        <View style={{ position: 'absolute', left: 9, top: 9, width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
      </>;
      break;
    case 'eye-off':
      shapes = <>
        <View style={[stroke, { position: 'absolute', left: 2, top: 7, width: 20, height: 10, borderRadius: 8 }]} />
        <View style={{ position: 'absolute', left: 9, top: 9, width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
        {line('slash', 3, 11, 19, '-45deg')}
      </>;
      break;
    default: shapes = <>

      <View style={[stroke, { position: 'absolute', left: 3, top: 4, width: 19, height: 18, borderRadius: 3 }]} />

      {line('a', 3, 9, 19)}

      {line('b', 5, 3, 5, '90deg')}

      {line('c', 15, 3, 5, '90deg')}

    </>;
  }
  return <View accessible={false} importantForAccessibility="no-hide-descendants" style={{ width: size, height: size }}>

    <View style={{ width: 24, height: 24, transform: [{ scale: size / 24 }], transformOrigin: 'top left' }}>

      {shapes}

    </View>

  </View>;
}
