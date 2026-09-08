(async () => {
  const out = {};
  const fire = document.querySelector('button[aria-label*="Concern"]');
  if (!fire) return { error: 'no fire marker' };
  fire.click();
  await new Promise((r) => setTimeout(r, 600));
  const card = document.querySelector('[class*="cm-fire-card"]') || Array.from(document.querySelectorAll('div')).find((d) => d.textContent && d.textContent.includes('View Fire'));
  out.cardFound = !!card;
  if (card) {
    out.cardText = (card.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 200);
  }
  const viewBtn = Array.from(document.querySelectorAll('[role="button"],button')).find((b) => b.textContent && b.textContent.includes('View Fire'));
  if (viewBtn) {
    viewBtn.click();
    await new Promise((r) => setTimeout(r, 1200));
    out.path = location.pathname;
    out.bodySample = (document.body.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 260);
  }
  return out;
})()
