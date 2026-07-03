import { Platform, TextStyle } from 'react-native';

/**
 * PropertyVerse design tokens.
 * Palette is derived from the brand logo — a warm orange gradient
 * (#F6A531 → #E53312) with a muted "verse" grey.
 */
export const colors = {
  // Brand
  primary: '#E9591C', // matches the "PROPERTY" wordmark
  primaryDark: '#C6410E', // pressed / emphasis
  primaryDarker: '#E53312', // deepest stop in the logo
  primaryTint: '#FDEDE1', // soft fill for badges / highlights
  primaryOn: '#FFF3EC', // text/desc on top of a primary surface

  accent: '#F2931A', // gold accent from the logo
  accentDark: '#EE7C19',
  accentTint: '#FEF3E2',

  // Surfaces
  background: '#FAF8F6', // warm off-white
  surface: '#FFFFFF',
  surfaceAlt: '#F4F0EB', // subtle raised/inset panels

  // Text
  text: '#221E1B', // warm near-black
  textMuted: '#78716C', // close to the logo's "verse" grey (#737272)
  textSubtle: '#A8A29E',

  // Lines
  border: '#ECE7E1',
  borderStrong: '#DED7CF',

  // Status
  danger: '#DC2626',
  dangerTint: '#FEECEC',
  success: '#16A34A',
  successTint: '#E7F6EC',
  warning: '#D97706',
  warningTint: '#FDF1E1',

  white: '#FFFFFF',
  black: '#000000',
} as const;

/** The ordered brand gradient stops (used for hero accents). */
export const brandGradient = ['#F6A531', '#F2931A', '#EE7C19', '#E9591C', '#E53312'] as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

const systemFont = Platform.select({
  ios: undefined, // San Francisco
  android: undefined, // Roboto
  default: undefined,
});

export const typography: Record<string, TextStyle> = {
  display: { fontFamily: systemFont, fontSize: 34, fontWeight: '800', letterSpacing: -0.5, color: colors.text },
  h1: { fontFamily: systemFont, fontSize: 28, fontWeight: '800', letterSpacing: -0.4, color: colors.text },
  h2: { fontFamily: systemFont, fontSize: 22, fontWeight: '700', letterSpacing: -0.2, color: colors.text },
  h3: { fontFamily: systemFont, fontSize: 18, fontWeight: '700', color: colors.text },
  body: { fontFamily: systemFont, fontSize: 15, fontWeight: '400', color: colors.text },
  bodyStrong: { fontFamily: systemFont, fontSize: 15, fontWeight: '600', color: colors.text },
  label: { fontFamily: systemFont, fontSize: 13, fontWeight: '600', color: colors.textMuted, letterSpacing: 0.2 },
  caption: { fontFamily: systemFont, fontSize: 13, fontWeight: '400', color: colors.textMuted },
  overline: { fontFamily: systemFont, fontSize: 12, fontWeight: '700', color: colors.textSubtle, letterSpacing: 1, textTransform: 'uppercase' },
};

/**
 * Elevation presets. On web we emit a CSS `boxShadow` (react-native-web 0.21
 * deprecated the individual `shadow*` props); on native we keep the classic
 * shadow/elevation props. Brand elements cast a matching orange glow.
 */
export const shadow = {
  none: {},
  sm: Platform.select({
    web: { boxShadow: '0px 1px 3px rgba(42,32,21,0.06)' },
    default: { shadowColor: '#2A2015', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 1 },
  }) as object,
  md: Platform.select({
    web: { boxShadow: '0px 6px 16px rgba(42,32,21,0.09)' },
    default: { shadowColor: '#2A2015', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.09, shadowRadius: 16, elevation: 4 },
  }) as object,
  lg: Platform.select({
    web: { boxShadow: '0px 14px 30px rgba(42,32,21,0.12)' },
    default: { shadowColor: '#2A2015', shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.12, shadowRadius: 30, elevation: 10 },
  }) as object,
  brand: Platform.select({
    web: { boxShadow: '0px 8px 20px rgba(233,89,28,0.32)' },
    default: { shadowColor: colors.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.32, shadowRadius: 18, elevation: 8 },
  }) as object,
} as const;
