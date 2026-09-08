/**
 * FireSight map design tokens. The map is a dark, subdued command surface:
 * near-black ocean, slightly lifted land, hairline geography, and a single
 * ember accent reserved for fire/heat/attention. Mirrors the landing page's
 * palette (see src/design/constants.ts) so both feel like one product.
 */
import { COLOR, FONT } from '../design/constants';
import { Ionicons } from '@expo/vector-icons';
import { severityColor, severityLabel, type Severity } from '../theme';
import type { MapFire } from '../types';

export const FONT_KEYS = FONT;
export const ACCENT = COLOR.accent; // ember — fire, heat, selected
export const ACCENT_HOT = '#f59a5c'; // inner core of an intense fire

// The four Concern Score categories share the app-wide severity palette.
export { severityColor as severityPalette, severityLabel as severityText };
export type { Severity as ConcernCategory };

/** Concern score → category, mirroring the backend's own bands (25/50/75). */
export function severityOfConcern(concern: number): Severity {
  if (concern < 25) return 'low';
  if (concern < 50) return 'moderate';
  if (concern < 75) return 'elevated';
  return 'high';
}

/**
 * Category for a fire: the backend-reported category when present, otherwise
 * derived from the concern score (older responses).
 */
export function fireSeverity(fire: Pick<MapFire, 'category' | 'concern'>): Severity {
  return fire.category ?? severityOfConcern(fire.concern);
}

export const mapPalette = {
  ocean: '#070B10',
  oceanDeep: '#05080C',
  land: '#10161D',
  landAlt: '#0E141A',
  lake: '#0A0F15',

  // Geography hairlines — subtle, never decorative.
  country: 'rgba(255,255,255,0.16)',
  internal: 'rgba(255,255,255,0.07)',
  grid: 'rgba(255,255,255,0.03)',

  // Text
  text: '#F4F6F8',
  textMuted: 'rgba(255,255,255,0.74)',
  textFaint: 'rgba(255,255,255,0.5)',

  // Glass surfaces (translucent tinted panels over the map)
  glass: 'rgba(10,14,19,0.72)',
  glassStrong: 'rgba(11,15,20,0.88)',
  glassBorder: 'rgba(255,255,255,0.13)',
  glassBorderSoft: 'rgba(255,255,255,0.09)',

  // Chip surfaces
  chipIdle: 'rgba(255,255,255,0.05)',
  chipIdleBorder: 'rgba(255,255,255,0.12)',
  chipActive: 'rgba(232,112,42,0.16)',
  chipActiveBorder: 'rgba(232,112,42,0.52)',

  on: 'rgba(255,255,255,0.94)',
  onDim: 'rgba(255,255,255,0.62)',
};

/** Height reserved under the map by chrome while computing initial camera. */
export const CAMERA_TOP_PAD = 120;
export const CAMERA_BOTTOM_PAD = 92;

export type IoniconName = keyof typeof Ionicons.glyphMap;

/** Map overlay layer ids — each maps to a filter chip + its render layer. */
export type MapLayerId =
  | 'fires'
  | 'heat'
  | 'perimeters'
  | 'air'
  | 'weather'
  | 'highConcern';

export interface LayerMeta {
  id: MapLayerId;
  label: string;
  icon: IoniconName;
  /** Shown as a small colored dot when on. */
  dot: string;
  defaultOn: boolean;
}

export const LAYERS: LayerMeta[] = [
  { id: 'fires', label: 'Active Heat', icon: 'flame', dot: ACCENT, defaultOn: true },
  { id: 'heat', label: 'Heat Anomalies', icon: 'thermometer-outline', dot: '#E8A23C', defaultOn: false },
  { id: 'perimeters', label: 'Fire Perimeters', icon: 'scan-outline', dot: '#C9A227', defaultOn: false },
  { id: 'air', label: 'Air Quality', icon: 'leaf-outline', dot: '#7FB8A0', defaultOn: false },
  { id: 'weather', label: 'Weather', icon: 'partly-sunny-outline', dot: '#8FB8C9', defaultOn: false },
  { id: 'highConcern', label: 'High Concern', icon: 'warning-outline', dot: '#F0503A', defaultOn: false },
];

/** Glass dimensions for round icon buttons (map controls). */
export const CONTROL_BTN = 44;
export const CONTROL_GAP = 8;
