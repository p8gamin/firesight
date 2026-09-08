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
    await wait(350);
    return true;
  };
  const chip = (label) =>
    Array.from(document.querySelectorAll('button')).find((b) => (b.getAttribute('aria-label') || '').trim() === label);
  return (async () => {
    const out = {};
    const layers = document.querySelector('button[aria-label="Map layers and filters"]');
    await tap(layers);
    for (const l of ['Heat Anomalies', 'Fire Perimeters']) {
      const c = chip(l);
      out['chip_' + l] = !!c;
      await tap(c);
    }
    // close panel
    await tap(layers);
    // locate — headless has no geolocation; expect graceful toast
    const loc = document.querySelector('button[aria-label="Center on your location"]');
    await tap(loc);
    await wait(700);
    const toast = Array.from(document.querySelectorAll('div')).find((d) => {
      const t = (d.textContent || '').trim();
      return /(Location|Locating|Centered)/.test(t) && t.length < 90;
    });
    out.toast = toast ? toast.textContent.replace(/\s+/g, ' ').trim() : null;
    return out;
  })();
})()
