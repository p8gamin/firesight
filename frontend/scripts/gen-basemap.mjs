/**
 * Generates src/map/basemapData.ts — the FireSight North America basemap.
 *
 * Downloads Natural Earth admin_0 (countries) + admin_1 (states/provinces) +
 * lakes at 50m, splits rings that cross the ±180° seam, clips polygons to the
 * North America viewport, projects to a Web-Mercator "plane" of WORLD_PX px,
 * simplifies to that resolution and emits one self-contained TypeScript
 * module (SVG path strings + region search anchors).
 *
 * Build-time data tool only — run `node scripts/gen-basemap.mjs`.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Projection — shared with the app via src/map/geo.ts (keep in sync).
// ---------------------------------------------------------------------------
const WORLD_PX = 4096; // keep in sync with src/map/geo.ts

const proj = (lon, lat) => {
  const x = ((lon + 180) / 360) * WORLD_PX;
  const y = WORLD_PX * (0.5 - Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) / (2 * Math.PI));
  return [x, y];
};

// Geographic viewport (most of North America + Central America).
const LON_MIN = -179;
const LON_MAX = -28;
const LAT_MIN = -4;
const LAT_MAX = 84;

// ---------------------------------------------------------------------------
// Seam split — rings whose longitudes jump across ±180° are cut into
// contiguous sub-rings so a projected polygon never draws across the plane.
// ---------------------------------------------------------------------------
function splitSeam(ring) {
  const out = [];
  let cur = [];
  for (let i = 0; i < ring.length; i++) {
    const pt = ring[i];
    const prev = cur.length ? cur[cur.length - 1] : ring[i - 1 >= 0 ? i - 1 : ring.length - 1];
    if (cur.length && Math.abs(pt[0] - prev[0]) > 180) {
      out.push(cur);
      cur = [];
    }
    cur.push(pt);
  }
  if (cur.length) out.push(cur);
  return out;
}

// ---------------------------------------------------------------------------
// Sutherland–Hodgman clip against the lon/lat viewport (all four edges).
// ---------------------------------------------------------------------------
function clipAxis(pts, get, edge, keepLess) {
  const inside = (p) => (keepLess ? get(p) <= edge : get(p) >= edge);
  const intersect = (a, b) => {
    const [ax, ay] = a;
    const [bx, by] = b;
    const t = (edge - get(a)) / (get(b) - get(a));
    return [ax + (bx - ax) * t, ay + (by - ay) * t];
  };
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const aIn = inside(a);
    if (aIn) out.push(a);
    if (aIn !== inside(b)) out.push(intersect(a, b));
  }
  return out;
}

function clipPolygon(ring) {
  let pts = ring.slice();
  pts = clipAxis(pts, (p) => p[0], LON_MIN, false); // keep x >= LON_MIN
  pts = clipAxis(pts, (p) => p[0], LON_MAX, true);  // keep x <= LON_MAX
  pts = clipAxis(pts, (p) => p[1], LAT_MIN, false); // keep y >= LAT_MIN
  pts = clipAxis(pts, (p) => p[1], LAT_MAX, true);  // keep y <= LAT_MAX
  return pts;
}

// ---------------------------------------------------------------------------
// Simplification in plane space.
// ---------------------------------------------------------------------------
function radialSimplify(pts, tol) {
  if (pts.length <= 2) return pts;
  const out = [pts[0]];
  let prev = pts[0];
  for (let i = 1; i < pts.length - 1; i++) {
    const dx = pts[i][0] - prev[0];
    const dy = pts[i][1] - prev[1];
    if (dx * dx + dy * dy > tol * tol) {
      out.push(pts[i]);
      prev = pts[i];
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

function perpDist(p, a, b) {
  const [px, py] = p;
  const [ax, ay] = a;
  const [bx, by] = b;
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function douglasPeucker(pts, tol) {
  if (pts.length <= 2) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = 1;
  keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  const sq = tol * tol;
  while (stack.length) {
    const [s, e] = stack.pop();
    let maxD = 0;
    let idx = -1;
    for (let i = s + 1; i < e; i++) {
      const d = perpDist(pts[i], pts[s], pts[e]);
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (maxD * maxD > sq && idx !== -1) {
      keep[idx] = 1;
      stack.push([s, idx], [idx, e]);
    }
  }
  const out = [];
  for (let i = 0; i < pts.length; i++) if (keep[i]) out.push(pts[i]);
  return out;
}

const simplify = (pts, tol) => douglasPeucker(radialSimplify(pts, tol / 2), tol);

function ringArea(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a) / 2;
}

// ---------------------------------------------------------------------------
// Feature conversion: GeoJSON MultiPolygon/Polygon -> projected plane rings.
// Returns array of rings (plane px), null when nothing survives the viewport.
// ---------------------------------------------------------------------------
const TOL = 0.35; // px (plane is WORLD_PX across)

function toRings(coords) {
  // coords is either Polygon [outer, ...holes] or MultiPolygon [poly...].
  const polys = coords[0] && Array.isArray(coords[0][0]) && typeof coords[0][0][0] === 'number' ? [coords] : coords;
  const clippedRings = [];
  for (const poly of polys) {
    for (const rawRing of poly) {
      // Quick longitude/latitude reject.
      let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
      for (const [x, y] of rawRing) {
        if (x < minLon) minLon = x;
        if (x > maxLon) maxLon = x;
        if (y < minLat) minLat = y;
        if (y > maxLat) maxLat = y;
      }
      if (maxLon < LON_MIN - 1 || minLon > LON_MAX + 1 || maxLat < LAT_MIN || minLat > LAT_MAX) continue;
      const subs = splitSeam(rawRing.slice(0, -1)); // drop the closing duplicate
      for (const sub of subs) {
        const clipped = clipPolygon(sub);
        if (clipped.length < 4) continue;
        const projPts = clipped.map(([lon, lat]) => proj(lon, lat));
        const simp = simplify(projPts, TOL);
        if (simp.length < 4 || ringArea(simp) < 1.2) continue;
        clippedRings.push(simp);
      }
    }
  }
  return clippedRings.length ? clippedRings : null;
}

function toD(rings) {
  let d = '';
  for (const ring of rings) {
    d += `M${Math.round(ring[0][0])} ${Math.round(ring[0][1])}`;
    for (let i = 1; i < ring.length; i++) d += `L${Math.round(ring[i][0])} ${Math.round(ring[i][1])}`;
    d += 'Z';
  }
  return d;
}

// ---------------------------------------------------------------------------
async function fetchJson(url) {
  const res = await fetch(url, { headers: { 'user-agent': 'firesight-basemap-gen' } });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
}

const SRC = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/';
const ADMIN1_URL = `${SRC}ne_50m_admin_1_states_provinces.geojson`;
const ADMIN0_URL = `${SRC}ne_50m_admin_0_countries.geojson`;
const LAKES_URL = `${SRC}ne_50m_lakes.geojson`;

// Countries subdivided into admin_1 within this dataset (US states + CA
// provinces at 50m; Mexico has no admin_1 at this resolution, so it is drawn
// as a plain country and its internal state lines are omitted).
const SUBDIVIDED = new Set(['USA', 'CAN']);

// Every NA country whose outline we draw; fill only when not subdivided.
const NA_CODES = new Set([
  'CAN', 'USA', 'MEX', 'GTM', 'BLZ', 'HND', 'SLV', 'NIC', 'CRI', 'PAN',
  'CUB', 'HTI', 'DOM', 'JAM', 'BHS', 'TTO', 'GRD', 'BRB', 'VCT', 'LCA',
  'DMA', 'ATG', 'KNA', 'GRL', 'PRI', 'VIR', 'ABW', 'CUW', 'TCA', 'CYM',
  'VGB', 'AIA', 'MSR', 'BLM', 'MAF', 'SXM', 'BMU',
]);

const landD = [];
const internalD = [];
const countryOutlineD = [];
const lakeD = [];
const regionMeta = [];
const seen = new Set();

const nameOf = (p) => (p.name_en || p.name || '').trim();

function pushRegion(code, name, anchor) {
  if (!name || seen.has(`${code}|${name}`)) return;
  seen.add(`${code}|${name}`);
  regionMeta.push({ code, name, lon: +anchor[0].toFixed(3), lat: +anchor[1].toFixed(3) });
}

function anchorOf(rings) {
  // Approximate center from the largest ring's mean coordinate.
  const big = rings.reduce((a, b) => (ringArea(b) > ringArea(a) ? b : a));
  let sx = 0, sy = 0, n = 0;
  const step = Math.max(1, Math.floor(big.length / 160));
  for (let i = 0; i < big.length; i += step) {
    // Convert plane px back to lon/lat for the search index.
    const lon = (big[i][0] / WORLD_PX) * 360 - 180;
    const lat = (2 * Math.atan(Math.exp((0.5 - big[i][1] / WORLD_PX) * 2 * Math.PI)) * 180) / Math.PI - 90;
    sx += lon;
    sy += lat;
    n++;
  }
  return [sx / n, sy / n];
}

// --- admin_1: fills + faint internal lines + search anchors ---------------
console.log('Fetching admin_1 (states/provinces)…');
const admin1 = await fetchJson(ADMIN1_URL);
for (const f of admin1.features) {
  const p = f.properties;
  if (!SUBDIVIDED.has(p.adm0_a3)) continue;
  const rings = toRings(f.geometry.coordinates);
  if (!rings) continue;
  // A province/state may have produced several sub-polygons after clipping;
  // emit each as an independent closed path (evenodd-safe across features).
  landD.push(...rings.map((r) => toD([r])));
  internalD.push(toD(rings));
  pushRegion(p.adm0_a3, nameOf(p), anchorOf(rings));
}

// --- admin_0: country fills (unsubdivided) + bright country outlines ------
console.log('Fetching admin_0 (countries)…');
const admin0 = await fetchJson(ADMIN0_URL);
for (const f of admin0.features) {
  const p = f.properties;
  const code = p.ADM0_A3;
  if (!NA_CODES.has(code)) continue;
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  for (const poly of polys) {
    const rings = toRings(poly);
    if (!rings) continue;
    countryOutlineD.push(toD(rings));
    if (!SUBDIVIDED.has(code)) {
      landD.push(...rings.map((r) => toD([r])));
    }
    if (!SUBDIVIDED.has(code)) pushRegion(code, p.NAME || nameOf(p), anchorOf(rings));
  }
}

// --- lakes big enough to read as water ------------------------------------
console.log('Fetching lakes…');
const lakes = await fetchJson(LAKES_URL);
for (const f of lakes.features) {
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  for (const poly of polys) {
    const rings = toRings(poly);
    if (!rings) continue;
    if (ringArea(rings[0]) < 6) continue;
    lakeD.push(...rings.map((r) => toD([r])));
  }
}

const cnt = (a) => a.reduce((s, d) => s + (d.match(/[LM]/g)?.length ?? 0), 0);
const kb = (a) => (a.reduce((s, d) => s + d.length, 0) / 1024).toFixed(0);
console.log(
  `land ${landD.length} (${kb(landD)}kb) internal ${internalD.length} (${kb(internalD)}kb) ` +
  `outline ${countryOutlineD.length} (${kb(countryOutlineD)}kb) lakes ${lakeD.length} (${kb(lakeD)}kb) ` +
  `regions ${regionMeta.length}`
);

const header = `/**
 * GENERATED by scripts/gen-basemap.mjs — do not edit by hand.
 *
 * North America basemap at Natural Earth 50m, clipped to the map viewport,
 * projected to a Web-Mercator plane of WORLD_PX px (see src/map/geo.ts) and
 * simplified to that resolution. Coordinates are plane px (rounded ints).
 *
 * Paint order: LAND -> LAKES -> COUNTRY -> INTERNAL.
 */

export const WORLD_PX = 4096;

`;

const out = header +
  'export const LAND_PATHS: string[] = ' + JSON.stringify(landD) + ';\n\n' +
  'export const LAKE_PATHS: string[] = ' + JSON.stringify(lakeD) + ';\n\n' +
  'export const COUNTRY_PATHS: string[] = ' + JSON.stringify(countryOutlineD) + ';\n\n' +
  'export const INTERNAL_PATHS: string[] = ' + JSON.stringify(internalD) + ';\n\n' +
  'export interface RegionMeta { code: string; name: string; lon: number; lat: number }\n' +
  'export const REGION_META: RegionMeta[] = ' + JSON.stringify(regionMeta) + ';\n';

mkdirSync(join(__dirname, '..', 'src', 'map'), { recursive: true });
writeFileSync(join(__dirname, '..', 'src', 'map', 'basemapData.ts'), out);
console.log('wrote src/map/basemapData.ts');

// --- QA preview: standalone SVG used to eyeball the geometry -----------------
const SC = 1024 / 4096;
const wrap = (d, attrs = '') => `<path d="${d}" ${attrs}/>`;
const svg =
  `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 4096 4096">` +
  `<rect width="4096" height="4096" fill="#0b0e11"/>` +
  landD.map((d) => wrap(d, 'fill="#9aa4ae"')).join('') +
  lakeD.map((d) => wrap(d, 'fill="#0b0e11"')).join('') +
  countryOutlineD.map((d) => wrap(d, 'fill="none" stroke="#e8702a" stroke-width="2"')).join('') +
  internalD.map((d) => wrap(d, 'fill="none" stroke="#5e6872" stroke-width="1.5"')).join('') +
  `</svg>`;
writeFileSync(join(__dirname, '..', 'scripts', 'basemap-preview.svg'), svg);
console.log('wrote scripts/basemap-preview.svg');
