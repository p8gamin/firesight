/**
 * Alerts domain helpers — the shared vocabulary between the Alerts screen,
 * its cards, and the alert detail route. All values here derive from the
 * Alert/ActivityGroup records in src/types; nothing is invented at render
 * time (missing data renders as '—').
 */
import type { ActivityGroup, Alert, AlertCategory, Severity } from '../types';
import type { IoniconName } from '../map/tokens';

/** The three severity levels the Alerts UI communicates. */
export type AlertLevel = 'high' | 'moderate' | 'low';

/**
 * Map the backend's four Severity values onto the three display levels.
 * 'elevated' reads as High — it is the step above Moderate in the data model.
 */
export function alertLevelOf(severity: Severity): AlertLevel {
  if (severity === 'high' || severity === 'elevated') return 'high';
  if (severity === 'moderate') return 'moderate';
  return 'low';
}

export const LEVEL_META: Record<
  AlertLevel,
  { label: string; color: string; glow: number; text: string }
> = {
  high: { label: 'High Concern', color: '#ED8C49', glow: 0.5, text: 'HIGH CONCERN' },
  moderate: { label: 'Moderate', color: '#D9A43C', glow: 0.3, text: 'MODERATE' },
  low: { label: 'Low', color: '#7C8A96', glow: 0.16, text: 'LOW' },
};

export const CATEGORY_META: Record<
  AlertCategory,
  { label: string; icon: IoniconName; color: string }
> = {
  fire: { label: 'Fire', icon: 'flame', color: '#ED8C49' },
  heat: { label: 'Heat', icon: 'thermometer-outline', color: '#E8A23C' },
  air: { label: 'Air Quality', icon: 'leaf-outline', color: '#7FB8A0' },
};

export type AlertFilter = 'all' | AlertCategory;

export const ALERT_FILTERS: { id: AlertFilter; label: string; icon: IoniconName }[] = [
  { id: 'all', label: 'All', icon: 'apps-outline' },
  { id: 'fire', label: 'Fire', icon: 'flame' },
  { id: 'heat', label: 'Heat', icon: 'thermometer-outline' },
  { id: 'air', label: 'Air Quality', icon: 'leaf-outline' },
];

/** "Near Home · 8.4 km" / "At Home" — distance readouts from real records. */
export function proximityLabel(alert: Pick<Alert, 'locationName' | 'distanceKm'>): string {
  if (alert.distanceKm <= 0) return `At ${alert.locationName}`;
  return `Near ${alert.locationName} · ${distanceLabel(alert.distanceKm)}`;
}

export function distanceLabel(km: number): string {
  return km >= 100 ? `${Math.round(km)} km` : `${km.toFixed(1)} km`;
}

/** Concise age, e.g. "3 h ago" — derived from the record's timestamp. */
export function ageLabel(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.floor(hours / 24)} d ago`;
}

export function pctLabel(n: number | undefined): string {
  return n === undefined ? '—' : `${Math.round(n * 100)}%`;
}

/** Detection-count label from the linked activity group (may be absent). */
export function detectionLabel(group: ActivityGroup | undefined): string {
  if (!group) return '—';
  return `${group.detectionCount} detection${group.detectionCount === 1 ? '' : 's'}`;
}