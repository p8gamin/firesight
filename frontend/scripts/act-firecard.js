(() => {
  const btn = document.querySelector('button[aria-label*="Concern"]');
  if (!btn) return { clicked: false, reason: 'no fire marker found' };
  const rect = btn.getBoundingClientRect();
  btn.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: rect.x + 4, clientY: rect.y + 4 }));
  return { clicked: true, aria: btn.getAttribute('aria-label'), x: Math.round(rect.x), y: Math.round(rect.y) };
})()
