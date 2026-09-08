// Reads generated basemap arrays and prints per-array stats.
import { readFileSync } from 'node:fs';

const t = readFileSync('src/map/basemapData.ts', 'utf8');
function arr(name) {
  const s = t.indexOf('export const ' + name);
  const a = t.indexOf('[', s);
  const seg = t.slice(a + 1, t.indexOf('];', s));
  const out = [];
  const re = /"((?:[^"\\]|\\.)*)"/g;
  let m;
  while ((m = re.exec(seg))) out.push(m[1]);
  return out;
}
for (const n of ['LAND_PATHS', 'LAKE_PATHS', 'COUNTRY_PATHS', 'INTERNAL_PATHS']) {
  const a = arr(n);
  const bytes = a.reduce((s, x) => s + x.length, 0);
  const pts = a.reduce((s, d) => s + (d.match(/[LM]/g) || []).length, 0);
  const lens = a.map((x) => x.length).sort((x, y) => y - x);
  console.log(n, 'n=', a.length, 'bytes=', bytes, 'pts~', pts);
  console.log('  top lens', lens.slice(0, 3).join(', '), 'smallest', lens[lens.length - 1]);
}
