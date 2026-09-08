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
    await wait(1400);
  };
  return (async () => {
    const body0 = (document.body.textContent || '').replace(/\s+/g, ' ').trim();
    const navItems = Array.from(document.querySelectorAll('[role="button"],button,a')).filter(
      (b) => (b.textContent || '').trim() === 'Map' && b.getBoundingClientRect().width > 0
    );
    const out = { path0: location.pathname, navMapFound: navItems.length, heroSample: body0.slice(0, 120) };
    if (navItems.length) {
      await tap(navItems[navItems.length - 1]);
      await wait(1800);
      out.path1 = location.pathname;
      out.mapPresent = !!document.querySelector('input[placeholder="Search a location"]');
      out.svgCount = document.querySelectorAll('svg').length;
    }
    return out;
  })();
})()
