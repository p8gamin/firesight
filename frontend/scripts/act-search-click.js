(() => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  return (async () => {
    const out = {};
    const input = document.querySelector('input[placeholder="Search a location"]');
    if (!input) return { error: 'no input' };
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, 'toronto');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await wait(500);

    // The row Pressables have no role attr — locate by text, pick the row whose
    // direct text is 'Toronto' + area 'Ontario', i.e. not a bare text node.
    const candidates = Array.from(document.querySelectorAll('div')).filter((d) => {
      const t = (d.textContent || '').trim();
      const direct = Array.from(d.childNodes)
        .filter((n) => n.nodeType === 3)
        .map((n) => n.textContent)
        .join('');
      return t === 'Toronto' || (t.includes('Toronto') && t.includes('Ontario') && d.children.length >= 3 && t.length < 40);
    });
    out.candidates = candidates.length;
    if (!candidates.length) return { ...out, error: 'no result row' };
    const row = candidates[candidates.length - 1];
    const r = row.getBoundingClientRect();
    const cx = r.x + r.width / 2;
    const cy = r.y + r.height / 2;
    const opts = { bubbles: true, cancelable: true, composed: true, clientX: cx, clientY: cy, button: 0, pointerId: 1, isPrimary: true };
    for (const type of ['pointerdown', 'mousedown']) row.dispatchEvent(new PointerEvent(type, opts));
    await wait(60);
    for (const type of ['pointerup', 'mouseup', 'click']) row.dispatchEvent(new PointerEvent(type, opts));
    out.tapped = { x: Math.round(cx), y: Math.round(cy), text: (row.textContent || '').trim() };

    await wait(2400);
    const svg = document.querySelector('svg');
    const planeTransform = (() => {
      let el = svg && svg.parentElement;
      for (let i = 0; i < 8 && el; i++) {
        const cs = getComputedStyle(el);
        if (cs.transform && cs.transform !== 'none') return cs.transform;
        el = el.parentElement;
      }
      return null;
    })();
    out.after = {
      path: location.pathname,
      transform: planeTransform,
      svgTexts: svg ? svg.querySelectorAll('text').length : 0,
      texts: svg ? Array.from(svg.querySelectorAll('text')).map((t) => t.textContent) : [],
    };
    return out;
  })();
})()
