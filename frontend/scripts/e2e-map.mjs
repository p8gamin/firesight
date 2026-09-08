/**
 * Playwright end-to-end check for the Leaflet + OpenStreetMap map screen.
 *
 * Run:
 *   1. `npx expo start --web --port 8091` (leave running)
 *   2. `node scripts/e2e-map.mjs`
 *
 * Uses the system Chrome (channel: 'chrome') — no browser download needed.
 *
 * The app starts EMPTY (no sample data): no saved locations and no fire
 * request until the user creates one. The suite therefore verifies the
 * real-data flow end to end: empty state → create → marker + name label →
 * persistence → edit → delete, plus live Nominatim geocoding.
 */
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL ?? 'http://localhost:8091';
const results = [];
const pageErrors = [];

function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? '✓ PASS' : '✗ FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

async function waitAndClick(locator, label) {
  await locator.waitFor({ state: 'visible', timeout: 15000 });
  await locator.click();
}

async function goToMap(page) {
  await page.goto(`${BASE}/map`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('.leaflet-container', { timeout: 45000 });
}

async function navTo(page, item) {
  await page.locator('a.cd-animated-nav-link', { hasText: new RegExp(`^${item}$`) }).first().click({ force: true });
  await page.waitForTimeout(1200);
}

async function runAddLocationFlow(page, search, name) {
  await waitAndClick(page.locator('[aria-label="Add a location"]'), 'open Add Location');
  await page.locator('[aria-label="Search a location"]:visible').first().fill(search);
  await page.waitForTimeout(1200);
  await waitAndClick(page.locator(`[aria-label^="Select ${search.split(',')[0]}"]`).first(), `pick ${search}`);
  await page.locator('[aria-label="Continue"]').click(); // → name
  await page.locator('[aria-label="Location name"]').fill(name);
  await page.locator('[aria-label="Continue"]').click(); // → monitoring
  await page.locator('[aria-label="Continue"]').click(); // → radius
  await page.locator('[aria-label="Continue"]').click(); // → alerts
  await page.locator('[aria-label="Continue"]').click(); // → review
  await waitAndClick(page.locator('[aria-label="Save location"]'), 'save');
  // Wait for the modal's close backdrop to go away before navigating on.
  await page.locator('[aria-label="Close"]').first().waitFor({ state: 'detached', timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(600);
}

const storedLocations = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('firesight.locations.v1') ?? '[]'));

const browser = await chromium.launch({ channel: 'chrome', headless: true });

try {
  // ====================== Desktop: the empty-start map ======================
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', (e) => pageErrors.push(String(e)));

  await goToMap(page);
  check('Leaflet map renders (.leaflet-container present)', true);

  await page.waitForSelector('.leaflet-tile-pane img', { timeout: 30000 });
  check('OpenStreetMap tiles load (real roads/streets imagery)', true);

  check('Zoom control present', (await page.locator('.leaflet-control-zoom-in').count()) > 0);
  check(
    'Fullscreen control present',
    (await page.locator('[aria-label="Toggle fullscreen view"]').count()) > 0
  );
  const attribution = await page.locator('.leaflet-control-attribution').first().textContent();
  check(
    'OpenStreetMap attribution shown',
    (attribution ?? '').includes('OpenStreetMap'),
    (attribution ?? '').trim().slice(0, 80)
  );

  // ---- Empty start: no fake data, get-started prompt takes over ----
  await page.waitForTimeout(1500); // allow any (there should be none) data to land
  const fireMarkersBefore = await page.locator('[data-firesight="fire-marker"]').count();
  check('No heat-anomaly markers without a saved location (no fake data)', fireMarkersBefore === 0, `${fireMarkersBefore} found`);
  const locMarkersBefore = await page.locator('[data-firesight="location-marker"]').count();
  check('No saved-location markers before the user creates one', locMarkersBefore === 0, `${locMarkersBefore} found`);
  await page.getByText('Create a location to get started').first().waitFor({ timeout: 8000 });
  check('Get-started prompt shown when no locations exist', true);

  // ---- Alerts tab: empty by default, prompts to add a location ----
  await navTo(page, 'Alerts');
  await page.getByText('No locations monitored yet').first().waitFor({ timeout: 8000 });
  check('Alerts tab shows no-locations prompt on first open (no fake alerts)', true);
  const fakeAlertCards = await page.locator('[aria-label^="Heat anomaly detected"], [aria-label^="View on map"]').count();
  check('Zero alert cards before any location exists', fakeAlertCards === 0, `${fakeAlertCards} found`);

  // ---- Locations tab: empty by default ----
  await navTo(page, 'Locations');
  await page.getByText('Monitor a place that matters').first().waitFor({ timeout: 8000 });
  check('Locations tab shows empty state on first open (no fake locations)', true);

  // ---- Create the first location via the get-started prompt ----
  await navTo(page, 'Map');
  await page.getByText('Create a location to get started').first().waitFor({ timeout: 8000 });
  await waitAndClick(page.locator('[aria-label="Create a location"]'), 'get-started button');
  await page.waitForTimeout(1200); // route to /locations
  await runAddLocationFlow(page, 'Toronto', 'Playwright Cottage');

  const created = (await storedLocations(page)).find((l) => l.name === 'Playwright Cottage');
  check('Created location persisted to storage', Boolean(created), JSON.stringify(created?.point ?? null));

  // Marker appears via SPA navigation (no page refresh).
  await navTo(page, 'Map');
  await page.waitForTimeout(1500);
  const marker = page.locator('[data-name="Playwright Cottage"]').first();
  check('New location marker appears immediately (no refresh)', (await marker.count()) === 1);
  const labelText = await marker.locator('div').first().textContent();
  check('Name label above the marker matches the saved name', labelText === 'Playwright Cottage', JSON.stringify(labelText));

  // With a saved location, monitoring starts: summary bar replaces the prompt.
  const summary = await page.getByText('ACTIVE HEAT GROUPINGS').count();
  check('Summary bar reads ACTIVE HEAT GROUPINGS once monitoring starts', summary > 0);

  // ---- Alerts tab now derives from real heat data around the location ----
  await navTo(page, 'Alerts');
  const noLocPrompt = await page.getByText('No locations monitored yet').count();
  check('No-locations prompt gone from Alerts once a location exists', noLocPrompt === 0);
  // Wait for the location-triggered fetch to reach a terminal state: real
  // alert cards (backend live), the honest error state (backend down), or
  // "no significant activity" (backend live, nothing detected nearby).
  // The live backend aggregates upstream feeds and can take 50-110 s.
  await page
    .getByText(/Heat anomaly detected|Alerts unavailable|No significant activity/)
    .first()
    .waitFor({ timeout: 170000 });
  const alertNodes = await page
    .locator('text=/Heat anomaly detected|Officially reported wildfire|Alerts unavailable|No significant activity/i')
    .count();
  check('Alerts tab shows live-derived alerts or an honest connection state', alertNodes > 0, `${alertNodes} nodes`);

  // Back to the map for the location-card flow.
  await navTo(page, 'Map');
  await page.waitForTimeout(1200);

  // Click the location marker → LocationCard.
  await marker.click({ force: true });
  await page.getByText('SAVED LOCATION', { exact: true }).first().waitFor({ timeout: 8000 });
  check('Location card opens on location marker click', true);
  await page.mouse.click(720, 240);
  await page.waitForTimeout(300);

  // ---- Persistence: hard reload ----
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.leaflet-tile-pane img', { timeout: 30000 });
  await page.waitForTimeout(1500);
  check(
    'Location marker remains after page refresh',
    (await page.locator('[data-name="Playwright Cottage"]').count()) === 1
  );

  // ---- Edit the location name ----
  await navTo(page, 'Locations');
  await waitAndClick(page.locator('[aria-label="Playwright Cottage — options"]'), 'open menu');
  await waitAndClick(page.locator('[aria-label="Change Name"]'), 'choose Change Name');
  await page.locator('[aria-label="New location name"]').fill('Renamed Cottage');
  await waitAndClick(page.locator('[aria-label="Save new name"]'), 'save name');
  await page.waitForTimeout(500); // the menu closes itself after rename

  const renamedInStore = (await storedLocations(page)).some((l) => l.name === 'Renamed Cottage');
  check('Edited location name persisted', renamedInStore);

  await navTo(page, 'Map');
  await page.waitForTimeout(1200);
  const renamedMarker = await page.locator('[data-name="Renamed Cottage"]').count();
  const oldMarker = await page.locator('[data-name="Playwright Cottage"]').count();
  check('Marker + label update after editing (renamed, no duplicates)', renamedMarker === 1 && oldMarker === 0);

  // ---- Delete the location ----
  await navTo(page, 'Locations');
  await waitAndClick(page.locator('[aria-label="Renamed Cottage — options"]'), 'open menu');
  await waitAndClick(page.locator('[aria-label="Remove Location"]'), 'choose Remove Location');
  await waitAndClick(page.locator('[aria-label="Remove Renamed Cottage"]'), 'confirm removal');
  await page.waitForTimeout(500);

  const stillInStore = (await storedLocations(page)).some((l) => l.name === 'Renamed Cottage');
  check('Deleted location removed from storage', !stillInStore);

  await navTo(page, 'Map');
  await page.waitForTimeout(1200);
  const locCountAfterDelete = await page.locator('[data-firesight="location-marker"]').count();
  check('Marker disappears after deleting the location', locCountAfterDelete === 0, `${locCountAfterDelete} left`);
  const promptBack = await page.getByText('Create a location to get started').count();
  check('Get-started prompt returns when the last location is removed', promptBack > 0);

  // ---- Zoom + pan smoke ----
  await page.mouse.wheel(0, -480); // zoom in
  await page.waitForTimeout(500);
  await page.mouse.move(720, 450);
  await page.mouse.down();
  await page.mouse.move(560, 520, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(800);
  check('Zoom + pan complete without page errors', pageErrors.length === 0, pageErrors.join(' | '));

  // =================== Live geocoding (free OSM Nominatim) ==================
  await navTo(page, 'Locations');
  await runAddLocationFlow(page, 'Eiffel Tower, Paris', 'Nominatim Test');
  try {
    const geoLoc = (await storedLocations(page)).find((l) => l.name === 'Nominatim Test');
    const nearParis =
      geoLoc && Math.abs(geoLoc.point.lat - 48.858) < 0.05 && Math.abs(geoLoc.point.lon - 2.294) < 0.05;
    check('Live geocoding resolves an address (Eiffel Tower via Nominatim)', Boolean(nearParis), JSON.stringify(geoLoc?.point ?? null));
  } catch {
    check('Live geocoding resolves an address (Eiffel Tower via Nominatim)', false, 'location did not save');
  }
  // Clean up the geocode-test location to leave the store tidy.
  await page.evaluate(() => {
    const list = JSON.parse(localStorage.getItem('firesight.locations.v1') ?? '[]');
    localStorage.setItem(
      'firesight.locations.v1',
      JSON.stringify(list.filter((l) => l.name !== 'Nominatim Test'))
    );
  });

  // ============================ Mobile viewport =============================
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  mobile.on('pageerror', (e) => pageErrors.push('mobile: ' + String(e)));
  await mobile.goto(`${BASE}/map`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await mobile.waitForSelector('.leaflet-container', { timeout: 45000 });
  await mobile.waitForSelector('.leaflet-tile-pane img', { timeout: 30000 });
  check('Map renders on a mobile viewport (390×844)', true);
  await mobile.getByText('Create a location to get started').first().waitFor({ timeout: 8000 });
  check('Get-started prompt visible on mobile', true);
  await mobile.close();
} finally {
  await browser.close();
}

console.log('\n-------------------------');
const failed = results.filter((r) => !r.ok);
console.log(`${results.length - failed.length}/${results.length} checks passed`);
if (failed.length > 0 || pageErrors.length > 0) {
  console.log('Failures:', failed.map((f) => f.name).join('; '));
  if (pageErrors.length) console.log('Page errors:', pageErrors.join('; '));
  process.exitCode = 1;
}
