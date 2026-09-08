(async () => {
  const out = {};
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  // --- 1. Search ---------------------------------------------
  const input = document.querySelector('input[placeholder="Search a location"]');
  out.inputFound = !!input;
  if (input) {
    // React 19 listens to 'input'; set via native setter to bypass the value tracker.
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, 'toronto');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.focus();
    await wait(400);
    const rows = Array.from(document.querySelectorAll('[role="button"],button,div')).filter((d) => {
      const t = d.textContent || '';
      return t.length < 40 && /Toronto/.test(t) && d.children.length <= 3;
    });
    out.suggestionRows = rows.length;
    out.firstRowText = rows[0] ? (rows[0].textContent || '').replace(/\s+/g, ' ').trim() : null;
    if (rows[0]) {
      rows[0].click();
      await wait(1800);
      const svgTexts = Array.from(document.querySelectorAll('svg text')).map((t) => t.textContent || '');
      out.afterFly = {
        path: location.pathname,
        hasTorontoLabel: svgTexts.includes('Toronto'),
        svgTextCount: svgTexts.length,
        labelsNear: svgTexts.slice(0, 8),
      };
    }
  }

  // --- 2. Filters --------------------------------------------
  const layersBtn = document.querySelector('button[aria-label="Map layers and filters"]');
  if (layersBtn) {
    layersBtn.click();
    await wait(350);
    const panel = Array.from(document.querySelectorAll('div')).find((d) => {
      const t = (d.textContent || '').replace(/\s+/g, ' ');
      return t.startsWith('Overlays') && t.includes('Active Fires');
    });
    out.filters = panel
      ? (panel.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120)
      : null;
  }

  // --- 3. Brand -> home --------------------------------------
  const brand = document.querySelector('[aria-label*="FireSight"]');
  out.brandFound = !!brand;
  if (brand) {
    brand.click();
    await wait(1400);
    out.pathAfterBrand = location.pathname;
    const body = document.body.textContent || '';
    out.heroH2 = /(See the smoke|Watch the fire|FireSight)/.test(body) ? 'unknown' : 'no';
    // hero detection: landing has distinctive copy
    out.bodySample = body.replace(/\s+/g, ' ').trim().slice(0, 150);
  }
  return out;
})()
