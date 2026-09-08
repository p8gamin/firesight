import React, { memo } from 'react';
import Svg, { Circle, Ellipse, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { LAND_PATHS, LAKE_PATHS, COUNTRY_PATHS, INTERNAL_PATHS } from './basemapData';
import { WORLD_PX, initialCamera, lonLatToPlane } from './geo';
import { screenToPlane } from './camera';
import { ACCENT, mapPalette } from './tokens';
import type { FirePerimeter, MapHeatRegion } from '../types';
import { REGION_LABELS, CITIES, type Place } from './gazetteer';

const PX_PER_DEG = WORLD_PX / 360;
const DEG_KM = 111.32;

/** km → plane px along the E-W axis at a given latitude. */
export function kmToPlaneX(lat: number, km: number): number {
  return (km / (DEG_KM * Math.cos((lat * Math.PI) / 180))) * PX_PER_DEG;
}
/** km → plane px along the N-S axis. */
export function kmToPlaneY(km: number): number {
  return (km / DEG_KM) * PX_PER_DEG;
}

/** Closed path string from lon/lat ring points. */
export function ringPath(points: { lat: number; lon: number }[]): string {
  if (!points.length) return '';
  let d = '';
  points.forEach((p, i) => {
    const { x, y } = lonLatToPlane(p.lon, p.lat);
    d += `${i === 0 ? 'M' : 'L'}${Math.round(x)} ${Math.round(y)}`;
  });
  return d + 'Z';
}

const GRID_STEP = 15;
const gridLines = (() => {
  const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];
  for (let lon = -180; lon <= 180; lon += GRID_STEP) {
    const { x } = lonLatToPlane(lon, 0);
    lines.push({ x1: x, y1: 0, x2: x, y2: WORLD_PX });
  }
  for (let lat = -75; lat <= 80; lat += GRID_STEP) {
    const { y } = lonLatToPlane(0, lat);
    lines.push({ x1: 0, y1: y, x2: WORLD_PX, y2: y });
  }
  return lines;
})();

const Basemap = memo(function Basemap() {
  return (
    <>
      {gridLines.map((l, i) => (
        <Line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke={mapPalette.grid} strokeWidth={1} />
      ))}
      <Rect width={WORLD_PX} height={WORLD_PX} fill={mapPalette.ocean} />
      {LAND_PATHS.map((d, i) => (
        <Path key={`l${i}`} d={d} fill={mapPalette.land} fillRule="evenodd" />
      ))}
      {LAKE_PATHS.map((d, i) => (
        <Path key={`k${i}`} d={d} fill={mapPalette.lake} fillRule="evenodd" />
      ))}
      {COUNTRY_PATHS.map((d, i) => (
        <Path key={`c${i}`} d={d} fill="none" stroke={mapPalette.country} strokeWidth={1} strokeLinejoin="round" />
      ))}
      {INTERNAL_PATHS.map((d, i) => (
        <Path key={`i${i}`} d={d} fill="none" stroke={mapPalette.internal} strokeWidth={0.9} strokeLinejoin="round" />
      ))}
    </>
  );
});

/** Soft radial heat region: concentric strokes + low-alpha fills (no gradients — identical on every renderer). */
const HeatBlob = memo(function HeatBlob({ region }: { region: MapHeatRegion }) {
  const { x, y } = lonLatToPlane(region.point.lon, region.point.lat);
  const rx = kmToPlaneX(region.point.lat, region.rxKm);
  const ry = kmToPlaneY(region.ryKm);
  const i = region.intensity;
  return (
    <>
      {[0, 1, 2, 3].map((ring) => {
        const f = 1 + ring * 0.62;
        return (
          <Ellipse
            key={ring}
            cx={x}
            cy={y}
            rx={rx * f}
            ry={ry * f}
            fill="none"
            stroke={ACCENT}
            strokeOpacity={Math.max(0.005, 0.07 * i * (1 - ring * 0.22))}
            strokeWidth={Math.max(1.4, rx * (0.06 + ring * 0.03))}
          />
        );
      })}
      <Ellipse cx={x} cy={y} rx={rx * 0.62} ry={ry * 0.62} fill={ACCENT} fillOpacity={0.09 * i} />
      <Ellipse cx={x} cy={y} rx={rx * 0.2} ry={ry * 0.2} fill={ACCENT} fillOpacity={0.22 * i} />
    </>
  );
});

const Perimeter = memo(function Perimeter({ perimeter, active }: { perimeter: FirePerimeter; active: boolean }) {
  const d = ringPath(perimeter.ring);
  return (
    <Path
      d={d}
      fill={ACCENT}
      fillOpacity={active ? 0.055 : 0.03}
      stroke={ACCENT}
      strokeOpacity={active ? 0.85 : 0.42}
      strokeWidth={active ? 2.6 : 1.5}
      strokeLinejoin="round"
    />
  );
});

export interface CameraSettle {
  s: number;
  tx: number;
  ty: number;
}

const LABEL_COLOR: Record<Place['kind'], string> = {
  country: 'rgba(255,255,255,0.74)',
  region: 'rgba(255,255,255,0.46)',
  city: 'rgba(255,255,255,0.6)',
};

/**
 * Zoom-tiered text labels. Label font is expressed in *screen* px per kind
 * and converted to plane px from the settled scale, so text keeps a steady
 * size between settles; labels beyond the visible region are culled.
 */
const Labels = memo(function Labels({
  settle,
  viewport,
}: {
  settle: CameraSettle;
  viewport: { width: number; height: number };
}) {
  const { s, tx, ty } = settle;
  // Visible plane window ± margin.
  const a = screenToPlane(0, 0, s, tx, ty);
  const b = screenToPlane(viewport.width, viewport.height, s, tx, ty);
  const pad = 240 / Math.max(s, 0.1);
  const minX = Math.min(a.x, b.x) - pad;
  const maxX = Math.max(a.x, b.x) + pad;
  const minY = Math.min(a.y, b.y) - pad;
  const maxY = Math.max(a.y, b.y) + pad;
  // Relative zoom: 1 = the initial framing view (label showAt thresholds are
  // authored in those units), not the raw plane scale.
  const rel = s / Math.max(initialCamera(viewport).s, 1e-4);

  const planeFont = (px: number) => Math.max(7, Math.round(px / Math.max(s, 0.12)));

  const regionRows = REGION_LABELS.filter((p) => {
    // Country names read at the framing view and above; regions/states step in
    // once you zoom toward them (per their showAt threshold).
    if (p.kind === 'country') return rel >= 0.55;
    if (p.showAt !== undefined && rel < p.showAt) return false;
    return true;
  });
  // Cities appear only once zoomed well past the framing view.
  const cityRows = rel >= 3.1 ? CITIES : [];

  const rows: {
    name: string;
    x: number;
    y: number;
    kind: Place['kind'];
    labelPx: number;
  }[] = [];

  for (const p of regionRows) {
    const { x, y } = lonLatToPlane(p.lon, p.lat);
    rows.push({ name: p.name, x, y, kind: p.kind, labelPx: p.labelPx ?? 13 });
  }
  for (const c of cityRows) {
    const { x, y } = lonLatToPlane(c.lon, c.lat);
    rows.push({ name: c.name, x, y, kind: 'city', labelPx: 10.5 });
  }

  return (
    <>
      {rows.map((l, i) => {
        if (l.x < minX || l.x > maxX || l.y < minY || l.y > maxY) return null;
        const fs = planeFont(l.labelPx);
        return (
          <SvgText
            key={`${l.kind}-${l.name}-${i}`}
            x={l.x}
            y={l.y}
            fill={LABEL_COLOR[l.kind]}
            fontSize={fs}
            fontFamily={l.kind === 'city' ? 'Inter_400Regular' : 'Inter_500Medium'}
            textAnchor="middle"
          >
            {l.name}
          </SvgText>
        );
      })}
    </>
  );
});

export interface MapSceneProps {
  heatRegions: MapHeatRegion[];
  perimeters: FirePerimeter[];
  selectedPerimeterId?: string | null;
  heatOn: boolean;
  settle: CameraSettle;
  viewport: { width: number; height: number };
  /** Compact contexts (location cards / detail maps) hide text labels. */
  labels?: boolean;
}

export const MapScene = memo(function MapScene({
  heatRegions,
  perimeters,
  selectedPerimeterId,
  heatOn,
  settle,
  viewport,
  labels = true,
}: MapSceneProps) {
  return (
    <Svg width={WORLD_PX} height={WORLD_PX}>
      <Basemap />
      {perimeters.map((p) => (
        <Perimeter key={p.id} perimeter={p} active={p.id === selectedPerimeterId} />
      ))}
      {heatOn && heatRegions.map((h) => <HeatBlob key={h.id} region={h} />)}
      {labels ? <Labels settle={settle} viewport={viewport} /> : null}
    </Svg>
  );
});
