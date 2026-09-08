(() => {
  const svg = document.querySelector('svg');
  if (!svg) return { error: 'no svg' };
  let el = svg.parentElement;
  for (let i = 0; i < 8 && el; i++) {
    const cs = getComputedStyle(el);
    if (cs.transform && cs.transform !== 'none') {
      return {
        transform: cs.transform,
        origin: cs.transformOrigin,
        svgTexts: svg.querySelectorAll('text').length,
        allTexts: Array.from(svg.querySelectorAll('text')).map((t) => t.textContent),
        suggestionsOpen: !!Array.from(document.querySelectorAll('div')).find(
          (d) => (d.textContent || '').trim().startsWith('Toronto') && d.textContent.length < 30
        ),
      };
    }
    el = el.parentElement;
  }
  return { error: 'no transformed ancestor' };
})()
