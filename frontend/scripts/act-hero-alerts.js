(async () => {
  const $$ = (s) => [...document.querySelectorAll(s)];
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const link = $$('.cd-animated-nav-link').find((el) => el.textContent === 'Alerts');
  if (!link) return { clicked: false };
  link.click();
  await wait(1600);
  const capsule = $$('.cd-animated-nav')[$$('.cd-animated-nav').length - 1];
  return {
    clicked: true,
    url: location.pathname,
    active: capsule?.querySelector('.cd-animated-nav-link-active')?.textContent ?? null,
    cards: $$('[aria-label$="Tap for details."]').length,
    heroScroll: document.documentElement.classList.contains('fs-hero-scroll'),
  };
})()