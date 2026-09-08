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
    await wait(500);
    return true;
  };
  return (async () => {
    const out = {};
    const layers = document.querySelector('button[aria-label="Map layers and filters"]');
    await tap(layers);
    // find the chip pressable: it has a cursor via cm-tap class maybe; grab elements whose
    // textContent === label and that are BUTTON-ish (role or tabindex)
    const pressables = Array.from(document.querySelectorAll('[role="button"],button,[tabindex]')).filter((el) => {
      const t = (el.textContent || '').trim();
      return /^(Active Fires|Heat Anomalies|High Concern|Fire Perimeters|Air Quality|Weather)$/.test(t);
    });
    out.chips = pressables.map((el) => ({
      tag: el.tagName,
      role: el.getAttribute('role'),
      tab: el.getAttribute('tabindex'),
      text: (el.textContent || '').trim(),
      classes: el.className || '',
    }));
    const firesChip = pressables.find((el) => (el.textContent || '').trim() === 'Active Fires');
    await tap(firesChip);
    out.remaining = Array.from(document.querySelectorAll('button[aria-label*="Concern"]')).map((b) => b.getAttribute('aria-label'));
    return out;
  })();
})()
