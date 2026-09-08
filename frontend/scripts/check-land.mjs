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
const planeTo = (x, y) => {
  const lon = (x / 4096) * 360 - 180;
  const lat = (2 * Math.atan(Math.exp((0.5 - y / 4096) * 2 * Math.PI)) * 180) / Math.PI - 90;
  return { lon: +lon.toFixed(1), lat: +lat.toFixed(1) };
};
const rows = [];
for (const d of arr('LAND_PATHS')) {
  const nums = d.match(/-?\d+(\.\d+)?/g).map(Number);
  let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
  for (let i = 0; i < nums.length; i += 2) {
    if (nums[i] < minX) minX = nums[i];
    if (nums[i] > maxX) maxX = nums[i];
    if (nums[i + 1] < minY) minY = nums[i + 1];
    if (nums[i + 1] > maxY) maxY = nums[i + 1];
  }
  rows.push({ dlen: d.length, area: (maxX - minX) * (maxY - minY), minX, maxX, minY, maxY });
}
rows.sort((a, b) => b.area - a.area);
console.log('total land paths', arr('LAND_PATHS').length);
for (const r of rows.slice(0, 14)) {
  const a = planeTo(r.minX, r.minY), b = planeTo(r.maxX, r.maxY);
  console.log(
    'area~' + Math.round(r.area / 1e6) + 'M dlen ' + r.dlen,
    'x ' + r.minX + '..' + r.maxX,
    'y ' + r.minY + '..' + r.maxY,
    '=> lon ' + a.lon + '..' + b.lon,
    'lat ' + b.lat + '..' + a.lat
  );
}
const sum = rows.reduce((s, r) => s + r.area, 0);
console.log('sum area Mpx2', Math.round(sum / 1e6));
