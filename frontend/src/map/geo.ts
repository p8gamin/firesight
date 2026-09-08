/**
 * FireSight map geometry.
 *
 * The basemap (see basemapData.ts) lives on a Web-Mercator "plane" of
 * WORLD_PX × WORLD_PX px covering the whole world (longitude −180..180).
 * A camera with scale `s` and translation (tx, ty) maps plane px to screen
 * px. Translation is expressed so the plane's own centre is the pivot:
 *
 *   screen(p) = p·s + O·(1 − s) + (tx, ty),   O = plane centre
 *
 * which makes pinch/fly math free of transform-origin surprises.
 *
 * WORLD_PX must match the generator in scripts/gen-basemap.mjs.
 */

export const WORLD_PX = 4096;
const PI = Math.PI;
export const O = WORLD_PX / 2;

/** lon/lat → plane px. */
export function lonLatToPlane(lon: number, lat: number): { x: number; y: number } {
  const x = ((lon + 180) / 360) * WORLD_PX;
  const y = WORLD_PX * (0.5 - Math.log(Math.tan(PI / 4 + (lat * PI) / 360)) / (2 * PI));
  return { x, y };
}

/** plane px → lon/lat (used for distance readouts from the view centre). */
export function planeToLonLat(x: number, y: number): { lon: number; lat: number } {
  const lon = (x / WORLD_PX) * 360 - 180;
  const lat = (2 * Math.atan(Math.exp((0.5 - y / WORLD_PX) * 2 * PI)) * 180) / PI - 90;
  return { lon, lat };
}

/** The North America content window that the initial view fits (plane px). */
export const NA_BBOX = (() => {
  const a = lonLatToPlane(-168, 8.5);
  const b = lonLatToPlane(-51, 83.5);
  return { minX: a.x, minY: a.y, maxX: b.x, maxY: b.y };
})();

export interface ViewportSize {
  width: number;
  height: number;
}

/** Minimum scale so the square plane always covers the viewport. */
export function coverScale({ width, height }: ViewportSize): number {
  return Math.max(width / WORLD_PX, height / WORLD_PX);
}

/**
 * Camera limits for the current viewport: never expose plane edges, never
 * zoom so deep that the 50m geometry blurs into steps.
 */
export function cameraLimits(v: ViewportSize) {
  const min = coverScale(v) * 1.02;
  const max = Math.max(min * 3.2, 9.5); // ~4° across a phone — province view
  return { min, max };
}

/**
 * Clamp a translation so the plane always covers the viewport at scale s.
 * (s is clamped to ≥ coverScale, so a valid window always exists.)
 */
export function clampTranslation(
  tx: number,
  ty: number,
  s: number,
  v: ViewportSize
): { tx: number; ty: number } {
  const boundX = O * (s - 1); // tx ≤ O(s−1) keeps the left edge at/below 0
  const loX = v.width - WORLD_PX * s - O * (1 - s);
  const boundY = O * (s - 1);
  const loY = v.height - WORLD_PX * s - O * (1 - s);
  return {
    tx: Math.max(Math.min(tx, boundX), loX),
    ty: Math.max(Math.min(ty, boundY), loY),
  };
}

/**
 * Fit a geographic box (lon/lat) into the viewport and return the camera
 * state (plane scale + translations) that centres it.
 */
export function fitToGeo(
  bbox: { minLon: number; minLat: number; maxLon: number; maxLat: number },
  v: ViewportSize,
  pad = 0.06
): { x: number; y: number; s: number; tx: number; ty: number } {
  const a = lonLatToPlane(bbox.minLon, bbox.maxLat);
  const b = lonLatToPlane(bbox.maxLon, bbox.minLat);
  const bw = Math.abs(b.x - a.x);
  const bh = Math.abs(b.y - a.y);
  const cx = (a.x + b.x) / 2;
  const cy = (a.y + b.y) / 2;
  const s = Math.min(v.width / bw, v.height / bh) * (1 - pad);
  return { x: cx, y: cy, s, tx: txFor(cx, cy, s, v).tx, ty: txFor(cx, cy, s, v).ty };
}

/** Translation that places plane point (x, y) at the viewport centre. */
export function txFor(x: number, y: number, s: number, v: ViewportSize) {
  const tx = v.width / 2 - x * s - O * (1 - s);
  const ty = v.height / 2 - y * s - O * (1 - s);
  return { tx, ty };
}

/** Initial North America view for a given viewport. */
export function initialCamera(v: ViewportSize) {
  const fit = fitToGeo(
    { minLon: -166, minLat: 12, maxLon: -52, maxLat: 82 },
    v
  );
  const { min } = cameraLimits(v);
  const s = Math.max(fit.s, min);
  const t = txFor(fit.x, fit.y, s, v);
  return { x: fit.x, y: fit.y, s, ...t };
}

export function clampScale(s: number, v: ViewportSize): number {
  const { min, max } = cameraLimits(v);
  return Math.max(min, Math.min(max, s));
}
