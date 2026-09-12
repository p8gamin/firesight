(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = {};

  // --- 1. Hero loads and the Get Started CTA exists ---
  const cta = document.querySelector('.cd-flowbtn');
  out.ctaFound = !!cta;
  out.ctaText = cta ? (cta.textContent || '').trim() : null;

  // --- 2. Click Get Started -> /signin ---
  if (cta) {
    cta.click();
    await wait(1600);
    out.pathAfterCta = location.pathname;
  }

  // --- 3. Sign-in screen content ---
  const body = document.body.innerText.replace(/\s+/g, ' ');
  out.hasWelcome = /Welcome Back/.test(body);
  out.hasEmail = /Email Address/.test(body);
  out.hasRemember = /Remember me/.test(body);
  out.hasSocial = /Google/.test(body) && /GitHub/.test(body);
  out.inputCount = document.querySelectorAll('input').length;

  // --- 4. Toggle to sign-up mode ---
  const signupLink = Array.from(document.querySelectorAll('div,span')).find(
    (d) => (d.textContent || '').trim() === 'Sign up' && d.children.length === 0
  );
  out.signupLinkFound = !!signupLink;
  if (signupLink) {
    signupLink.click();
    await wait(600);
    const body2 = document.body.innerText.replace(/\s+/g, ' ');
    out.hasCreateAccount = /Create Account/.test(body2);
    out.signupHidesRemember = !/Remember me/.test(body2);
  }

  // --- 5. Back button returns to the hero ---
  const back = document.querySelector('[aria-label="Go back"]');
  out.backFound = !!back;
  if (back) {
    back.click();
    await wait(1600);
    out.pathAfterBack = location.pathname;
  }

  return out;
})()
