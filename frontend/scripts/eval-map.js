(() => {
  const out = {};
  out.window = { w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio };
  const svg = document.querySelector('svg');
  if (!svg) return { ...out, error: 'no svg' };
  const svgRect = svg.getBoundingClientRect();
  out.svgRect = { x: svgRect.x, y: svgRect.y, w: svgRect.width, h: svgRect.height };
  // walk up from svg to the element carrying the camera transform
  let el = svg.parentElement;
  let plane = null;
  for (let i = 0; i < 6 && el; i++) {
    const cs = getComputedStyle(el);
    if (cs.transform && cs.transform !== 'none') {
      plane = {
        transform: cs.transform,
        origin: cs.transformOrigin,
        w: el.style.width,
        h: el.style.height,
        rect: (() => {
          const r = el.getBoundingClientRect();
          return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
        })(),
      };
      break;
    }
    el = el.parentElement;
  }
  out.plane = plane;
  // sample land path rect (first <path> with a big d) to confirm geometry
  const paths = svg.querySelectorAll('path');
  out.pathCount = paths.length;
  let big = null;
  for (const p of paths) {
    const d = p.getAttribute('d') || '';
    if (d.length > 400) {
      const r = p.getBoundingClientRect();
      big = { dlen: d.length, fill: p.getAttribute('fill'), rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } };
      break;
    }
  }
  out.bigPath = big;
  // elements that overlay the map (markers etc.) count
  out.textCount = svg.querySelectorAll('text').length;
  // effective overflow/visibility of svg
  out.svgStyle = { overflow: getComputedStyle(svg).overflow, visibility: getComputedStyle(svg).visibility, display: getComputedStyle(svg).display };
  return out;
})()
