// Shared Material color roles, native type scale and spacing.
import { Platform,TextStyle } from 'react-native';
export const lightColors = {
  darkSurface: '#13271F', darkRaised: '#254235', onDarkSurface: '#F3F8F4', darkMuted: '#BFD0C4', darkDivider: '#456050',
  background: '#F4F7F5', surface: '#FFFFFF', raised: '#EAF0EC', olive: '#DCECE3', divider: '#D9E2DC', outline: '#6B7D73',
  text: '#162C24', secondary: '#435B4F', muted: '#52675B', accent: '#17654B', onAccent: '#FFFFFF',
  success: '#1D6144', successBg: '#E0F1E6', warning: '#735215', warningBg: '#FFF1D2', error: '#A12D34', errorBg: '#FCE5E6', info: '#275D78', infoBg: '#E3EFF6',
  overlay: '#FFFFFF', overlayEdge: '#D9E2DC', scrim: '#101E2870', frost: '#FFFFFF00', inverse: '#19392C', onInverse: '#F4FAF6', skeleton: '#DFE8E2', skeletonHighlight: '#EAF0EC',
};
export const darkColors: typeof lightColors = {
  darkSurface: '#0B1510', darkRaised: '#203C2C', onDarkSurface: '#F0F7F1', darkMuted: '#BDD0C2', darkDivider: '#405D4A',
  background: '#101A16', surface: '#192720', raised: '#23352B', olive: '#294B38', divider: '#35483C', outline: '#82968A',
  text: '#ECF4EE', secondary: '#C0D1C5', muted: '#ACBFB0', accent: '#92D3AE', onAccent: '#103721',
  success: '#9EDBB1', successBg: '#1E3928', warning: '#F0D18C', warningBg: '#3A301B', error: '#FFB7BA', errorBg: '#43262B', info: '#B2D7EF', infoBg: '#213849',
  overlay: '#23352B', overlayEdge: '#435A4C', scrim: '#00000099', frost: '#FFFFFF00', inverse: '#DFEEE4', onInverse: '#19392C', skeleton: '#293D31', skeletonHighlight: '#35483C',
};
let palette = lightColors;
export const setPalette = (mode: 'light' | 'dark') => {
  palette = mode === 'dark' ? darkColors : lightColors;
};
export const colors = new Proxy({} as typeof lightColors, { get: (_, key: keyof typeof lightColors) => palette[key] });
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, section: 36 } as const;
export const radius = { field: 12, card: 16, pill: 24, sheet: 24 } as const;
export const elevation = { toast: 6, sheet: 16, dialog: 12 } as const;
export const motion = { enter: 180, exit: 120, shimmer: 1100, toast: 6000, overlayDelay: 300 } as const;
const fontFamily = Platform.select({ android: 'sans-serif', default: undefined });
export const type = {
  display: { fontFamily, fontSize: 36, lineHeight: 44, fontWeight: '700', letterSpacing: -0.7 },
  heading: { fontFamily, fontSize: 28, lineHeight: 36, fontWeight: '700', letterSpacing: -0.5 },
  title: { fontFamily, fontSize: 24, lineHeight: 32, fontWeight: '600', letterSpacing: -0.3 },
  section: { fontFamily, fontSize: 20, lineHeight: 28, fontWeight: '600' },
  body: { fontFamily, fontSize: 16, lineHeight: 24, fontWeight: '400' },
  strong: { fontFamily, fontSize: 16, lineHeight: 24, fontWeight: '600' },
  label: { fontFamily, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  caption: { fontFamily, fontSize: 14, lineHeight: 20, fontWeight: '400' },
  score: { fontFamily, fontSize: 44, lineHeight: 52, fontWeight: '700', fontVariant: ['tabular-nums'] },
} satisfies Record<string, TextStyle>;
