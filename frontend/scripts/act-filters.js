(() => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const tap = async (el) => {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const cx = r.x + r.width / 2;
    const cy = r.y + r.height / 2;
    const opts = { bubbles: true, cancelable: true, composed: true, clientX: cx, clientY: cy, button: 0, pointerId: 1, isPrimary: true };
    for (const type of ['pointerdown', 'mousedown']) el.dispatchEvent(new PointerEvent(type, opts));
    await wait(50);
    for (const type of ['pointerup', 'mouseup', 'click']) el.dispatchEvent(new PointerEvent(type, opts));
    await wait(320);
    return true;
  };
  const fireCount = () => document.querySelectorAll('button[aria-label*="Concern"]').length;
  const scaleOf = () => {
    const svg = document.querySelector('svg');
    let el = svg && svg.parentElement;
    for (let i = 0; i < 8 && el; i++) {
      const cs = getComputedStyle(el);
      if (cs.transform && cs.transform !== 'none') return cs.transform;
      el = el.parentElement;
    }
    return null;
  };
  return (async () => {
    const out = { firesInitial: fireCount() };

    // zoom in twice
    const zIn = document.querySelector('button[aria-label="Zoom in"]');
    await tap(zIn);
    await tap(zIn);
    out.afterZoomScale = scaleOf();

    // frame NA to reset
    const frame = document.querySelector('button[aria-label="Frame North America"]');
    await tap(frame);
    out.afterFrameScale = scaleOf();

    // open filters, then toggle High Concern
    const layers = document.querySelector('button[aria-label="Map layers and filters"]');
    await tap(layers);
    const chip = (label) =>
      Array.from(document.querySelectorAll('div,button')).find((d) => {
        const t = (d.textContent || '').trim();
        const directKids = Array.from(d.childNodes).filter((n) => n.nodeType === 3);
        return t === label && d.children.length <= 2;
      });
    const high = chip('High Concern');
    out.highChipFound = !!high;
    await tap(high);
    out.firesHighOnly = fireCount();

    // toggle Active Fires off -> no markers at all
    const firesChip = chip('Active Fires');
    out.firesChipFound = !!firesChip;
    await tap(firesChip);
    out.firesAfterToggleOff = fireCount();

    // heat + perimeters chips exist
    out.heatChip = !!chip('Heat Anomalies');
    out.perimChip = !!chip('Fire Perimeters');
    return out;
  })();
})()
