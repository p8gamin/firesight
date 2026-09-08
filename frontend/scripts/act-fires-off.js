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
    await wait(400);
    return true;
  };
  return (async () => {
    const fireCount = () => document.querySelectorAll('button[aria-label*="Concern"]').length;
    const out = { firesInitial: fireCount() };
    const layers = document.querySelector('button[aria-label="Map layers and filters"]');
    await tap(layers);
    const chip = (label) =>
      Array.from(document.querySelectorAll('div,button')).find((d) => {
        const t = (d.textContent || '').trim();
        return t === label && d.children.length <= 2;
      });
    const firesChip = chip('Active Fires');
    out.firesChipFound = !!firesChip;
    await tap(firesChip);
    out.firesAfterOff = fireCount();
    // also grab chip pressed state text (first letter marker may indicate on/off)
    out.chipStates = Array.from(document.querySelectorAll('div'))
      .filter((d) => d.children.length <= 2 && /^(Active Fires|Heat Anomalies|High Concern)$/.test((d.textContent || '').trim()))
      .map((d) => d.textContent.trim());
    return out;
  })();
})()
