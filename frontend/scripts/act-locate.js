(() => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const tap = async (el) => {
    const r = el.getBoundingClientRect();
    const cx = r.x + r.width / 2;
    const cy = r.y + r.height / 2;
    const opts = { bubbles: true, cancelable: true, composed: true, clientX: cx, clientY: cy, button: 0, pointerId: 1, isPrimary: true };
    for (const type of ['pointerdown', 'mousedown']) el.dispatchEvent(new PointerEvent(type, opts));
    await wait(50);
    for (const type of ['pointerup', 'mouseup', 'click']) el.dispatchEvent(new PointerEvent(type, opts));
    await wait(600);
  };
  return (async () => {
    const loc = document.querySelector('button[aria-label="Center on your location"]');
    if (!loc) return { error: 'no locate button' };
    await tap(loc);
    const body = document.body.textContent || '';
    const m = body.match(/(Location unavailable[^A-Z]{0,80}|Centered on your location|Locating…)/g);
    return { toastMatches: m ? m.slice(0, 3) : [], hasSpinner: !!document.querySelector('[role="progressbar"]') };
  })();
})()
