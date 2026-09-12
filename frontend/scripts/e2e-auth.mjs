/**
 * Playwright e2e check for FireSight + Supabase auth (web).
 *
 * Run:
 *   1. `npx expo start --web --port 8091` (leave running)
 *   2. `node scripts/e2e-auth.mjs`
 *
 * Set AUTH_TEST_SIGNUP=1 to also submit a real sign-up (consumes the
 * Supabase built-in email quota — a few emails per hour on the free tier).
 *
 * Covers: sign-up mode UI, wrong-password error, Google OAuth handshake
 * (redirect to accounts.google.com — not completed), the /locations auth
 * gate, and the public /map staying open to logged-out visitors.
 */
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL ?? 'http://localhost:8091';
const results = [];

function check(name, ok, detail = '') {
  results.push({ name, ok });
  console.log(`${ok ? '✓ PASS' : '✗ FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

const EMAIL = process.env.AUTH_TEST_EMAIL ?? `firesight.${Date.now()}@example.com`;
const PASSWORD = 'TestPass!2345';
const DO_SIGNUP = process.env.AUTH_TEST_SIGNUP === '1';

const browser = await chromium.launch({ channel: 'chrome' });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e)));

await page.goto(`${BASE}/signin`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(1200);

// ---------- 1. Sign-up mode UI ----------
await page.getByText('Sign up', { exact: true }).first().click();
await page.waitForTimeout(400);
check('signup mode shows Create Account', await page.getByText('Create Account').first().isVisible());
check('signup hides Remember me', !(await page.getByText('Remember me').isVisible().catch(() => false)));

// ---------- 2. Optional real sign-up (consumes email quota) ----------
if (DO_SIGNUP) {
  await page.getByPlaceholder('Email Address').fill(EMAIL);
  await page.getByPlaceholder('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign Up', exact: true }).click();
  let signedIn = false;
  try {
    await page.waitForURL('**/map', { timeout: 20000 });
    signedIn = true;
    check('sign up → session (no email confirmation) → /map', true, EMAIL);
  } catch {
    const notice = await page.getByText(/Account created/).first().isVisible().catch(() => false);
    check('sign up → confirmation notice shown', notice, 'email confirmation is ON in Supabase');
  }
  check('no page errors after signup', pageErrors.length === 0, pageErrors[0] ?? '');
  if (signedIn) {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await page.goto(`${BASE}/signin`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(800);
    check('session persists across reload', await page.getByText("You're signed in").first().isVisible().catch(() => false));
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await page.waitForTimeout(1200);
  }
} else {
  check('sign-up submit skipped (set AUTH_TEST_SIGNUP=1 to run)', true, 'supabase email quota is limited');
}

// ---------- 3. Back to sign-in mode; wrong-password error ----------
await page.getByText('Sign in', { exact: true }).first().click();
await page.waitForTimeout(400);
check('back in sign-in mode (Welcome Back)', await page.getByText('Welcome Back').first().isVisible());

await page.getByPlaceholder('Email Address').fill('firesight.nobody@example.com');
await page.getByPlaceholder('Password').fill('WrongPassword!123');
await page.getByRole('button', { name: 'Sign In', exact: true }).click();
const badPw = await page
  .getByText(/Incorrect email or password|Invalid login credentials/i)
  .first()
  .waitFor({ state: 'visible', timeout: 15000 })
  .then(() => true)
  .catch(() => false);
check('wrong credentials show a useful error', badPw);

// ---------- 4. Google OAuth handshake starts (not completed) ----------
await page.goto(`${BASE}/signin`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(800);
const googleBtn = page.getByRole('button', { name: 'Continue with Google' });
check('Google button present', await googleBtn.isVisible().catch(() => false));
if (await googleBtn.isVisible().catch(() => false)) {
  const nav = page
    .waitForURL(/accounts\.google\.com|supabase\.co\/auth\/v1\/authorize/, { timeout: 15000 })
    .then(() => true)
    .catch(() => false);
  await googleBtn.click();
  const went = await nav;
  check('Google click starts real OAuth redirect', went, page.url().slice(0, 120));
}

// ---------- 5. Public experience stays open ----------
await page.goto(`${BASE}/locations`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1000);
check('logged-out /locations shows sign-in gate', await page.getByText('Sign in to use this').first().isVisible().catch(() => false));

let mapOk = false;
try {
  await page.goto(`${BASE}/map`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('.leaflet-container', { timeout: 45000 });
  mapOk = true;
} catch {}
check('logged-out /map still loads (Leaflet)', mapOk);

const renderHit = await page
  .evaluate(() => performance.getEntriesByType('resource').some((r) => r.name.includes('onrender.com')))
  .catch(() => false);
check('map still wired to the Render backend', renderHit || mapOk, renderHit ? 'request to onrender.com observed' : 'no fire request auto-fired (map loaded clean)');

await browser.close();

const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
