(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = {};

  // Click Get Started from the hero.
  const cta = document.querySelector('.cd-flowbtn');
  if (!cta) return { err: 'no cta' };
  cta.click();
  await wait(2500);
  out.path = location.pathname;

  // Walk UP from the email input to find the outermost ~viewport-width box
  // (the AuthScreen root), then inspect its layout tree.
  const input = document.querySelectorAll('input')[0];
  if (!input) return { ...out, err: 'no input' };
  const ir = input.getBoundingClientRect();
  out.inputY = Math.round(ir.y);
  out.inputVisible = ir.y > 0 && ir.y + ir.height < window.innerHeight;

  let root = input;
  for (let i = 0; i < 20 && root; i++) {
    const r = root.getBoundingClientRect();
    if (Math.round(r.width) >= window.innerWidth - 30) break;
    root = root.parentElement;
  }
  const rr = root.getBoundingClientRect();
  out.root = { w: Math.round(rr.width), h: Math.round(rr.height) };

  // splitRoot's children: [imagePanel, formPanel]
  const splitRow = root.firstElementChild;
  const panel = splitRow ? splitRow.firstElementChild : null;
  const panelR = panel ? panel.getBoundingClientRect() : null;
  out.panel = panelR ? { x: Math.round(panelR.x), w: Math.round(panelR.width), h: Math.round(panelR.height) } : null;
  out.panelHTMLTags = panel
    ? Array.from(panel.children).map((c) => `${c.tagName}:${Math.round(c.getBoundingClientRect().width)}x${Math.round(c.getBoundingClientRect().height)}`)
    : null;

  // Any <img> inside the panel?
  const panelImg = panel ? panel.querySelector('img') : null;
  const pr = panelImg ? panelImg.getBoundingClientRect() : null;
  out.panelImg = pr ? { w: Math.round(pr.width), h: Math.round(pr.height), complete: panelImg.complete } : null;

  // Dark-theme spot checks: field shell + submit button computed colors.
  const shellCs = getComputedStyle(input.closest('div'));
  out.field = { bg: shellCs.backgroundColor, border: shellCs.borderColor };
  const submit = Array.from(document.querySelectorAll('div')).find(
    (d) => d.textContent === 'Sign In' && d.children.length <= 1 && d.getBoundingClientRect().height > 40
  );
  out.submitBg = submit ? getComputedStyle(submit).backgroundColor : null;
  out.bodyBg = getComputedStyle(document.body).backgroundColor;

  return out;
})()
