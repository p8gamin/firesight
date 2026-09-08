/**
 * Minimal PNG reader for headless-Chrome screenshot QA.
 *
 *   node scripts/pnginfo.mjs file.png dims
 *   node scripts/pnginfo.mjs file.png sample x y [x y ...]
 *   node scripts/pnginfo.mjs file.png grid              # 6x10 block averages
 *   node scripts/pnginfo.mjs file.png colors            # top quantized colors
 *   node scripts/pnginfo.mjs file.png orange            # count fire-orange pixels
 *   node scripts/pnginfo.mjs file.png region x0 y0 x1 y1  # avg color in a rect
 */
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

const png = readFileSync(process.argv[2]);
let pos = 8;
let width = 0, height = 0, bitDepth = 0, colorType = 0;
const idat = [];
while (pos < png.length) {
  const len = png.readUInt32BE(pos);
  const type = png.toString('ascii', pos + 4, pos + 8);
  const data = png.subarray(pos + 8, pos + 8 + len);
  if (type === 'IHDR') {
    width = data.readUInt32BE(0);
    height = data.readUInt32BE(4);
    bitDepth = data[8];
    colorType = data[9];
  } else if (type === 'IDAT') idat.push(data);
  pos += 12 + len;
  if (type === 'IEND') break;
}
if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6)) {
  console.error('unsupported png', { bitDepth, colorType });
  process.exit(1);
}
const bpp = colorType === 6 ? 4 : 3;
const raw = inflateSync(Buffer.concat(idat));
const stride = width * bpp;
const out = Buffer.alloc(width * height * 4);

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

let o = 0;
for (let y = 0; y < height; y++) {
  const filter = raw[o++];
  const lineStart = y * stride;
  for (let x = 0; x < stride; x++) {
    const rawByte = raw[o];
    const left = x >= bpp ? raw[lineStart + x - bpp] : 0;
    const up = y > 0 ? raw[lineStart - stride + x] : 0;
    const upLeft = y > 0 && x >= bpp ? raw[lineStart - stride + x - bpp] : 0;
    let v = rawByte;
    if (filter === 1) v = (v + left) & 255;
    else if (filter === 2) v = (v + up) & 255;
    else if (filter === 3) v = (v + ((left + up) >> 1)) & 255;
    else if (filter === 4) v = (v + paeth(left, up, upLeft)) & 255;
    o++;
    raw[lineStart + x] = v;
  }
}
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const s = y * stride + x * bpp;
    const di = (y * width + x) * 4;
    out[di] = raw[s];
    out[di + 1] = raw[s + 1];
    out[di + 2] = raw[s + 2];
    out[di + 3] = bpp === 4 ? raw[s + 3] : 255;
  }
}

const px = (x, y) => {
  const di = (y * width + x) * 4;
  return { r: out[di], g: out[di + 1], b: out[di + 2], a: out[di + 3] };
};

const cmd = process.argv[3];
if (cmd === 'sample') {
  for (let i = 4; i + 1 < process.argv.length; i += 2) {
    const x = +process.argv[i];
    const y = +process.argv[i + 1];
    if (Number.isFinite(x) && Number.isFinite(y)) {
      const p = px(x, y);
      console.log(`(${x},${y}) rgb(${p.r},${p.g},${p.b})`);
    }
  }
} else if (cmd === 'grid') {
  const cols = 6;
  const rows = 10;
  for (let gy = 0; gy < rows; gy++) {
    const row = [];
    for (let gx = 0; gx < cols; gx++) {
      let r = 0, g = 0, b = 0, n = 0;
      for (let y = Math.floor((gy / rows) * height); y < Math.floor(((gy + 1) / rows) * height); y += 3)
        for (let x = Math.floor((gx / cols) * width); x < Math.floor(((gx + 1) / cols) * width); x += 3) {
          const p = px(x, y);
          r += p.r; g += p.g; b += p.b; n++;
        }
      row.push(`${Math.round(r / n)},${Math.round(g / n)},${Math.round(b / n)}`);
    }
    console.log(row.join('  '));
  }
} else if (cmd === 'colors') {
  const counts = new Map();
  for (let y = 0; y < height; y += 3)
    for (let x = 0; x < width; x += 3) {
      const p = px(x, y);
      const key = `${p.r >> 4},${p.g >> 4},${p.b >> 4}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14);
  for (const [k, n] of top) {
    const [r, g, b] = k.split(',').map((v) => Number(v) * 16);
    console.log(
      `rgb(${r},${g},${b})  ${((n / total) * 100).toFixed(1)}%`
    );
  }
} else if (cmd === 'orange') {
  let n = 0;
  for (let y = 0; y < height; y += 2)
    for (let x = 0; x < width; x += 2) {
      const p = px(x, y);
      if (p.r > 150 && p.g > 60 && p.g < 200 && p.b < 120) n++;
    }
  console.log('orange-ish pixels:', n);
} else if (cmd === 'ascii') {
  const cols = Number(process.argv[4] || 60);
  const rows = Number(process.argv[5] || 44);
  // optional crop: ascii cols rows x0 y0 x1 y1
  const hasCrop = process.argv.length >= 10 && Number.isFinite(Number(process.argv[6]));
  const RX0 = hasCrop ? Number(process.argv[6]) : 0;
  const RY0 = hasCrop ? Number(process.argv[7]) : 0;
  const RX1 = hasCrop ? Number(process.argv[8]) : width;
  const RY1 = hasCrop ? Number(process.argv[9]) : height;
  const cw = RX1 - RX0;
  const ch = RY1 - RY0;
  const classOf = (r, g, b) => {
    // orange / warm accent
    if (r > 150 && g > 60 && g < 210 && b < 130) return 'O';
    if (r > 120 && g > 70 && b < 90) return 'o';
    // white-ish text / bright chrome
    if (r > 130 && g > 130 && b > 130) return '.';
    // land fill ~(16,22,29) is the lightest dark; ocean ~(7,11,16) darkest
    const lum = (r + g + b) / 3;
    if (lum > 20) return lum > 60 ? (r > g ? '#' : ':') : '#';
    if (lum > 13) return lum > 15 ? '+' : '·';
    return ' ';
  };
  for (let gy = 0; gy < rows; gy++) {
    let line = '';
    for (let gx = 0; gx < cols; gx++) {
      const x0 = RX0 + Math.floor((gx / cols) * cw);
      const y0 = RY0 + Math.floor((gy / rows) * ch);
      let r = 0, g = 0, b = 0, n = 0, ox = 0;
      for (let y = y0; y < Math.min(RY1, y0 + Math.ceil(ch / rows)); y += 2)
        for (let x = x0; x < Math.min(RX1, x0 + Math.ceil(cw / cols)); x += 2) {
          const p = px(x, y);
          r += p.r; g += p.g; b += p.b; n++;
          if (p.r > 150 && p.g > 60 && p.g < 210 && p.b < 130) ox++;
        }
      r /= n; g /= n; b /= n;
      line += ox > n * 0.35 ? 'O' : classOf(r, g, b);
    }
    console.log(line);
  }
} else if (cmd === 'region') {
  const x0 = +process.argv[4], y0 = +process.argv[5], x1 = +process.argv[6], y1 = +process.argv[7];
  let r = 0, g = 0, b = 0, n = 0;
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      const p = px(x, y);
      r += p.r; g += p.g; b += p.b; n++;
    }
  console.log(`region avg rgb(${Math.round(r / n)},${Math.round(g / n)},${Math.round(b / n)})`);
} else {
  console.log(`image ${width}x${height} bitdepth ${bitDepth} colorType ${colorType}`);
}
