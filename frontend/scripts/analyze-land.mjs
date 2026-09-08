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
const buckets = {};
const land = arr('LAND_PATHS');
for (const d of land) {
  const nums = d.match(/-?\d+(\.\d+)?/g).map(Number);
  let sx = 0, sy = 0, n = 0, minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
  for (let i = 0; i < nums.length; i += 2) {
    sx += nums[i]; sy += nums[i + 1]; n++;
    if (nums[i] < minX) minX = nums[i];
    if (nums[i] > maxX) maxX = nums[i];
    if (nums[i + 1] < minY) minY = nums[i + 1];
    if (nums[i + 1] > maxY) maxY = nums[i + 1];
  }
  const lon = (sx / n / 4096) * 360 - 180;
  const lat = (2 * Math.atan(Math.exp((0.5 - sy / n / 4096) * 2 * Math.PI)) * 180) / Math.PI - 90;
  const area = (maxX - minX) * (maxY - minY);
  const key =
    lon < -135 ? 'far-west(Pac/AK)'
    : lat > 55 ? (lon < -100 ? 'arctic-west' : 'arctic-east')
    : lon < -100 ? 'west-US/CA' : 'east-US/CA/Carib';
  if (!buckets[key]) buckets[key] = { n: 0, area: 0 };
  buckets[key].n++;
  buckets[key].area += area;
}
for (const k of Object.keys(buckets)) console.log(k, buckets[k].n, 'paths area~' + Math.round(buckets[k].area / 1000) + 'k px2');
