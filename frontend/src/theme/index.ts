/**
 * Central design tokens — the FireSight visual language translated to
 * native. Dark, layered, calm; a single ember accent used sparingly.
 */

export const palette = {
  // Background depths (darkest → lighter surface)
  bg: '#0B0E11',
  bgElevated: '#11151B',
  surface: '#161B22',
  surfaceHover: '#1C232C',

  // Borders / hairlines
  border: '#232B35',
  borderSubtle: '#1B222B',

  // Text
  text: '#F4F6F8',
  textMuted: '#9AA4AE',
  textFaint: '#5E6872',

  // Accent (ember) — used sparingly for primary actions + high concern
  accent: '#E8702A',
  accentDim: '#D2611F',
  accentSoft: 'rgba(232,112,42,0.14)',

  // Semantic (severity) — calm, not alarming
  low: '#3FB68B',
  moderate: '#E0A32E',
  elevated: '#E8702A',
  high: '#D9534F',

  // Overlay / chip surfaces
  glass: 'rgba(22,27,34,0.72)',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 40,
} as const;

export const radius = {
  sm: 10,
  md: 16,
  lg: 22,
  xl: 30,
  pill: 999,
} as const;

export const typography = {
  // Display headings (tight, bold, sans — the FireSight voice)
  hero: { fontSize: 44, lineHeight: 42, fontWeight: '700' as const, letterSpacing: -2 },
  h1: { fontSize: 32, lineHeight: 36, fontWeight: '700' as const, letterSpacing: -1 },
  h2: { fontSize: 22, lineHeight: 27, fontWeight: '700' as const, letterSpacing: -0.4 },
  h3: { fontSize: 17, lineHeight: 22, fontWeight: '600' as const, letterSpacing: -0.2 },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400' as const },
  bodySmall: { fontSize: 13, lineHeight: 19, fontWeight: '400' as const },
  caption: { fontSize: 11, lineHeight: 15, fontWeight: '500' as const, letterSpacing: 0.2 },
  label: { fontSize: 12, lineHeight: 16, fontWeight: '600' as const, letterSpacing: 0.4 },
} as const;

export const shadow = {
  card: {
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  float: {
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
} as const;

export type Severity = 'low' | 'moderate' | 'elevated' | 'high';

export const severityColor: Record<Severity, string> = {
  low: palette.low,
  moderate: palette.moderate,
  elevated: palette.elevated,
  high: palette.high,
};

export const severityLabel: Record<Severity, string> = {
  low: 'Low',
  moderate: 'Moderate',
  elevated: 'Elevated',
  high: 'High',
};
