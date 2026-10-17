// MOB-01…12 / NFR-ACC-01: approved reference-led design system.
import { Platform, TextStyle } from 'react-native';

export const darkColors = {
  background: '#151816', surface: '#202421', raised: '#2B302C', olive: '#303A2C',
  divider: '#3C443E', outline: '#7C887F', text: '#F1F3EF', secondary: '#C1C9C1',
  muted: '#ABB6AC', accent: '#B9D98C', onAccent: '#18200B',
  success: '#A8DAB5', successBg: '#1D3022', warning: '#E7C874', warningBg: '#352F1F',
  error: '#FFB4AB', errorBg: '#38221F', info: '#B7D5F2', infoBg: '#20303E',
} as const;
type Palette = { [K in keyof typeof darkColors]: string };
export const lightColors: Palette = {
  background:'#F4F5F2',surface:'#FFFFFF',raised:'#E9EDE6',olive:'#E3ECD8',
  divider:'#CAD3C0',outline:'#68785B',text:'#1B2117',secondary:'#45523C',muted:'#54614B',
  accent:'#405B16',onAccent:'#FFFFFF',success:'#235532',successBg:'#DBEEDF',
  warning:'#654C0B',warningBg:'#FFF0CA',error:'#922B22',errorBg:'#FCE2DD',info:'#225172',infoBg:'#E0EDF8',
};
let activePalette: Palette = darkColors;
export const setPalette = (mode: 'dark'|'light') => { activePalette=mode==='dark'?darkColors:lightColors; };
/** Shared imports resolve the active palette at render time. */
export const colors = new Proxy({} as Palette, { get: (_target,key: keyof Palette) => activePalette[key] });
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { field: 12, card: 16, pill: 24 } as const;
const fontFamily = Platform.select({ android: 'sans-serif', default: undefined });
export const type = {
  display: { fontFamily, fontSize: 36, lineHeight: 44, fontWeight: '600', letterSpacing: -0.7 },
  heading: { fontFamily, fontSize: 28, lineHeight: 36, fontWeight: '600', letterSpacing: -0.4 },
  title: { fontFamily, fontSize: 22, lineHeight: 28, fontWeight: '500' },
  section: { fontFamily, fontSize: 20, lineHeight: 28, fontWeight: '600' },
  body: { fontFamily, fontSize: 16, lineHeight: 24, fontWeight: '400' },
  strong: { fontFamily, fontSize: 16, lineHeight: 24, fontWeight: '600' },
  label: { fontFamily, fontSize: 14, lineHeight: 20, fontWeight: '500' },
  caption: { fontFamily, fontSize: 14, lineHeight: 20, fontWeight: '400' },
  score: { fontFamily, fontSize: 44, lineHeight: 52, fontWeight: '700', fontVariant: ['tabular-nums'] },
} satisfies Record<string, TextStyle>;
