(() => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const rect = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), bottom: Math.round(r.bottom), right: Math.round(r.right) };
  };
  return (async () => {
    const fire = document.querySelector('button[aria-label*="Concern"]');
    fire.click();
    await wait(900);
    const card = Array.from(document.querySelectorAll('div')).find((d) => (d.textContent || '').includes('View Fire') && d.getBoundingClientRect().width > 250 && d.getBoundingClientRect().height < 600);
    const ctrl = Array.from(document.querySelectorAll('button[aria-label="Zoom in"]')).map((b) => b.parentElement.parentElement).find(() => true);
    // controls live in an absolutely-positioned column; find via zoom-in button ancestor chain
    let col = document.querySelector('button[aria-label="Zoom in"]');
    const chain = [];
    for (let i = 0; i < 5 && col; i++) {
      const cs = getComputedStyle(col);
      chain.push({ pos: cs.position, top: cs.top, h: col.offsetHeight });
      col = col.parentElement;
    }
    return { card: rect(card), ctrlChain: chain };
  })();
})()
