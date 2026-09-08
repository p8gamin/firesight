/**
 * Curated FireSight place data.
 *
 * - SEARCH: cities + states/provinces + countries the search field resolves
 *   (fly-to targets). States/provinces come from the generated basemap data.
 * - LABELS: hand-placed map labels at three zoom tiers (countries, regions,
 *   cities) so the geography reads like a real monitoring map without the
 *   basemap turning noisy.
 */
import { REGION_META } from './basemapData';

export type PlaceKind = 'city' | 'region' | 'country';

export interface Place {
  id: string;
  name: string;
  kind: PlaceKind;
  /** Short qualifier shown under the name (state/province/country). */
  area: string;
  lon: number;
  lat: number;
  /** Map label font size on screen (px) at the tier it appears. */
  labelPx?: number;
  /** Relative zoom at which the label appears (1 = the framing view). */
  showAt?: number;
}

// --- Labels / cities --------------------------------------------------------
const C = (
  id: string,
  name: string,
  area: string,
  lon: number,
  lat: number
): Place => ({ id, name, kind: 'city', area, lon, lat });

export const CITIES: Place[] = [
  // Canada
  C('toronto', 'Toronto', 'Ontario', -79.383, 43.653),
  C('montreal', 'Montréal', 'Québec', -73.567, 45.502),
  C('vancouver', 'Vancouver', 'British Columbia', -123.121, 49.283),
  C('calgary', 'Calgary', 'Alberta', -114.071, 51.05),
  C('edmonton', 'Edmonton', 'Alberta', -113.49, 53.545),
  C('ottawa', 'Ottawa', 'Ontario', -75.697, 45.421),
  C('quebec-city', 'Québec City', 'Québec', -71.208, 46.813),
  C('winnipeg', 'Winnipeg', 'Manitoba', -97.139, 49.895),
  C('halifax', 'Halifax', 'Nova Scotia', -63.575, 44.649),
  C('saskatoon', 'Saskatoon', 'Saskatchewan', -106.67, 52.133),
  C('regina', 'Regina', 'Saskatchewan', -104.618, 50.445),
  C('victoria', 'Victoria', 'British Columbia', -123.366, 48.428),
  C('yellowknife', 'Yellowknife', 'Northwest Territories', -114.371, 62.454),
  C('whitehorse', 'Whitehorse', 'Yukon', -135.054, 60.721),
  // United States
  C('new-york', 'New York', 'New York', -74.006, 40.713),
  C('los-angeles', 'Los Angeles', 'California', -118.244, 34.052),
  C('chicago', 'Chicago', 'Illinois', -87.63, 41.878),
  C('houston', 'Houston', 'Texas', -95.37, 29.76),
  C('phoenix', 'Phoenix', 'Arizona', -112.074, 33.448),
  C('philadelphia', 'Philadelphia', 'Pennsylvania', -75.166, 39.952),
  C('san-antonio', 'San Antonio', 'Texas', -98.494, 29.424),
  C('san-diego', 'San Diego', 'California', -117.161, 32.716),
  C('dallas', 'Dallas', 'Texas', -96.797, 32.777),
  C('austin', 'Austin', 'Texas', -97.743, 30.267),
  C('miami', 'Miami', 'Florida', -80.191, 25.762),
  C('atlanta', 'Atlanta', 'Georgia', -84.388, 33.749),
  C('washington', 'Washington', 'District of Columbia', -77.037, 38.907),
  C('boston', 'Boston', 'Massachusetts', -71.059, 42.36),
  C('seattle', 'Seattle', 'Washington', -122.332, 47.606),
  C('portland', 'Portland', 'Oregon', -122.676, 45.523),
  C('san-francisco', 'San Francisco', 'California', -122.419, 37.775),
  C('denver', 'Denver', 'Colorado', -104.99, 39.739),
  C('las-vegas', 'Las Vegas', 'Nevada', -115.139, 36.17),
  C('salt-lake-city', 'Salt Lake City', 'Utah', -111.891, 40.761),
  C('minneapolis', 'Minneapolis', 'Minnesota', -93.266, 44.978),
  C('detroit', 'Detroit', 'Michigan', -83.046, 42.331),
  C('kansas-city', 'Kansas City', 'Missouri', -94.579, 39.1),
  C('st-louis', 'St. Louis', 'Missouri', -90.199, 38.627),
  C('new-orleans', 'New Orleans', 'Louisiana', -90.071, 29.951),
  C('memphis', 'Memphis', 'Tennessee', -90.049, 35.15),
  C('nashville', 'Nashville', 'Tennessee', -86.782, 36.162),
  C('albuquerque', 'Albuquerque', 'New Mexico', -106.651, 35.085),
  C('tucson', 'Tucson', 'Arizona', -110.974, 32.222),
  C('boise', 'Boise', 'Idaho', -116.215, 43.615),
  C('anchorage', 'Anchorage', 'Alaska', -149.9, 61.218),
  C('honolulu', 'Honolulu', 'Hawaii', -157.858, 21.307),
  C('cleveland', 'Cleveland', 'Ohio', -81.695, 41.5),
  C('pittsburgh', 'Pittsburgh', 'Pennsylvania', -79.996, 40.441),
  C('buffalo', 'Buffalo', 'New York', -78.879, 42.886),
  C('orlando', 'Orlando', 'Florida', -81.379, 28.538),
  C('jacksonville', 'Jacksonville', 'Florida', -81.656, 30.332),
  C('raleigh', 'Raleigh', 'North Carolina', -78.638, 35.78),
  C('charlotte', 'Charlotte', 'North Carolina', -80.843, 35.227),
  C('oklahoma-city', 'Oklahoma City', 'Oklahoma', -97.516, 35.468),
  C('omaha', 'Omaha', 'Nebraska', -95.938, 41.257),
  C('reno', 'Reno', 'Nevada', -119.814, 39.53),
  // Mexico
  C('mexico-city', 'Mexico City', 'Mexico', -99.133, 19.433),
  C('guadalajara', 'Guadalajara', 'Mexico', -103.35, 20.677),
  C('monterrey', 'Monterrey', 'Mexico', -100.316, 25.686),
  C('tijuana', 'Tijuana', 'Mexico', -117.038, 32.515),
  C('cancun', 'Cancún', 'Mexico', -86.847, 21.161),
  C('merida', 'Mérida', 'Mexico', -89.62, 20.967),
  C('puebla', 'Puebla', 'Mexico', -98.206, 19.041),
  C('chihuahua', 'Chihuahua', 'Mexico', -106.069, 28.635),
  // Greenland
  C('nuuk', 'Nuuk', 'Greenland', -51.722, 64.183),
];

export const REGION_LABELS: Place[] = [
  // Canada provinces + territories
  { id: 'lb-can', name: 'Canada', kind: 'country', area: '', lon: -102, lat: 61.2, labelPx: 30, showAt: 0.8 },
  { id: 'lb-yukon', name: 'Yukon', kind: 'region', area: 'Canada', lon: -134.5, lat: 63.4, labelPx: 14, showAt: 1.4 },
  { id: 'lb-nwt', name: 'N.W.T.', kind: 'region', area: 'Canada', lon: -119, lat: 64.6, labelPx: 14, showAt: 1.4 },
  { id: 'lb-nunavut', name: 'Nunavut', kind: 'region', area: 'Canada', lon: -84, lat: 66.5, labelPx: 14, showAt: 1.6 },
  { id: 'lb-bc', name: 'British Columbia', kind: 'region', area: 'Canada', lon: -126.6, lat: 54.4, labelPx: 14, showAt: 1.4 },
  { id: 'lb-ab', name: 'Alberta', kind: 'region', area: 'Canada', lon: -114.5, lat: 53.2, labelPx: 14, showAt: 1.4 },
  { id: 'lb-sk', name: 'Saskatchewan', kind: 'region', area: 'Canada', lon: -106.2, lat: 52.3, labelPx: 14, showAt: 1.4 },
  { id: 'lb-mb', name: 'Manitoba', kind: 'region', area: 'Canada', lon: -98.4, lat: 53.8, labelPx: 14, showAt: 1.4 },
  { id: 'lb-on', name: 'Ontario', kind: 'region', area: 'Canada', lon: -86.4, lat: 50.6, labelPx: 14, showAt: 1.4 },
  { id: 'lb-qc', name: 'Québec', kind: 'region', area: 'Canada', lon: -71.2, lat: 52.6, labelPx: 14, showAt: 1.4 },
  { id: 'lb-nl', name: 'Newfoundland', kind: 'region', area: 'Canada', lon: -56.8, lat: 52.4, labelPx: 13, showAt: 1.8 },
  { id: 'lb-ns', name: 'Nova Scotia', kind: 'region', area: 'Canada', lon: -63, lat: 45.1, labelPx: 11, showAt: 2 },
  // US states
  { id: 'lb-usa', name: 'United States', kind: 'country', area: '', lon: -100.8, lat: 39.1, labelPx: 30, showAt: 0.8 },
  { id: 'lb-ak', name: 'Alaska', kind: 'region', area: 'United States', lon: -151.5, lat: 63.4, labelPx: 15, showAt: 1.4 },
  { id: 'lb-wa', name: 'Washington', kind: 'region', area: 'United States', lon: -120.2, lat: 47.1, labelPx: 12, showAt: 2 },
  { id: 'lb-or', name: 'Oregon', kind: 'region', area: 'United States', lon: -120.5, lat: 43.9, labelPx: 12, showAt: 2 },
  { id: 'lb-ca', name: 'California', kind: 'region', area: 'United States', lon: -119.7, lat: 36.9, labelPx: 15, showAt: 1.7 },
  { id: 'lb-nv', name: 'Nevada', kind: 'region', area: 'United States', lon: -116.8, lat: 38.9, labelPx: 12, showAt: 2.2 },
  { id: 'lb-az', name: 'Arizona', kind: 'region', area: 'United States', lon: -111.5, lat: 34.1, labelPx: 13, showAt: 2 },
  { id: 'lb-nm', name: 'New Mexico', kind: 'region', area: 'United States', lon: -106.4, lat: 34.2, labelPx: 12, showAt: 2 },
  { id: 'lb-ut', name: 'Utah', kind: 'region', area: 'United States', lon: -111.6, lat: 39.3, labelPx: 11, showAt: 2.4 },
  { id: 'lb-id', name: 'Idaho', kind: 'region', area: 'United States', lon: -114.8, lat: 44.6, labelPx: 12, showAt: 2.2 },
  { id: 'lb-mt', name: 'Montana', kind: 'region', area: 'United States', lon: -109.6, lat: 47, labelPx: 13, showAt: 2 },
  { id: 'lb-wy', name: 'Wyoming', kind: 'region', area: 'United States', lon: -107.6, lat: 43.1, labelPx: 12, showAt: 2.4 },
  { id: 'lb-co', name: 'Colorado', kind: 'region', area: 'United States', lon: -105.8, lat: 39, labelPx: 13, showAt: 2.2 },
  { id: 'lb-tx', name: 'Texas', kind: 'region', area: 'United States', lon: -99.2, lat: 31.3, labelPx: 15, showAt: 1.8 },
  { id: 'lb-ok', name: 'Oklahoma', kind: 'region', area: 'United States', lon: -97.7, lat: 35.6, labelPx: 11, showAt: 2.6 },
  { id: 'lb-ks', name: 'Kansas', kind: 'region', area: 'United States', lon: -98.4, lat: 38.4, labelPx: 11, showAt: 2.6 },
  { id: 'lb-ne', name: 'Nebraska', kind: 'region', area: 'United States', lon: -99.8, lat: 41.5, labelPx: 11, showAt: 2.6 },
  { id: 'lb-nd', name: 'N. Dakota', kind: 'region', area: 'United States', lon: -100.4, lat: 47.4, labelPx: 11, showAt: 2.6 },
  { id: 'lb-sd', name: 'S. Dakota', kind: 'region', area: 'United States', lon: -100.2, lat: 44.3, labelPx: 11, showAt: 2.6 },
  { id: 'lb-mn', name: 'Minnesota', kind: 'region', area: 'United States', lon: -94.2, lat: 46.2, labelPx: 12, showAt: 2.4 },
  { id: 'lb-wi', name: 'Wisconsin', kind: 'region', area: 'United States', lon: -89.9, lat: 44.6, labelPx: 12, showAt: 2.4 },
  { id: 'lb-il', name: 'Illinois', kind: 'region', area: 'United States', lon: -89.2, lat: 40, labelPx: 12, showAt: 2.6 },
  { id: 'lb-mi', name: 'Michigan', kind: 'region', area: 'United States', lon: -85.2, lat: 44.8, labelPx: 12, showAt: 2.4 },
  { id: 'lb-fl', name: 'Florida', kind: 'region', area: 'United States', lon: -81.6, lat: 28.1, labelPx: 13, showAt: 2.2 },
  { id: 'lb-la', name: 'Louisiana', kind: 'region', area: 'United States', lon: -91.9, lat: 30.9, labelPx: 11, showAt: 2.6 },
  { id: 'lb-ga', name: 'Georgia', kind: 'region', area: 'United States', lon: -83.2, lat: 32.8, labelPx: 11, showAt: 2.6 },
  // Mexico
  { id: 'lb-mex', name: 'Mexico', kind: 'country', area: '', lon: -102.4, lat: 23.6, labelPx: 24, showAt: 0.9 },
  // Greenland
  { id: 'lb-grl', name: 'Greenland', kind: 'country', area: '', lon: -41.5, lat: 71.9, labelPx: 20, showAt: 0.9 },
];

// Region/state/province search rows derived from the generated geometry.
export const ALL_REGIONS: Place[] = REGION_META.map((r) => {
  const countryNames: Record<string, string> = {
    CAN: 'Canada', USA: 'United States', MEX: 'Mexico', GTM: 'Guatemala', BLZ: 'Belize',
    HND: 'Honduras', SLV: 'El Salvador', NIC: 'Nicaragua', CRI: 'Costa Rica', PAN: 'Panama',
    CUB: 'Cuba', HTI: 'Haiti', DOM: 'Dominican Republic', JAM: 'Jamaica', BHS: 'Bahamas',
    TTO: 'Trinidad & Tobago', GRD: 'Grenada', BRB: 'Barbados', VCT: 'St. Vincent', LCA: 'Saint Lucia',
    DMA: 'Dominica', ATG: 'Antigua', KNA: 'St. Kitts', GRL: 'Greenland', PRI: 'Puerto Rico',
    VIR: 'U.S. Virgin Islands', ABW: 'Aruba', CUW: 'Curaçao', TCA: 'Turks & Caicos', CYM: 'Cayman Islands',
    VGB: 'British Virgin Islands', AIA: 'Anguilla', MSR: 'Montserrat', BLM: 'Saint Barthélemy',
    MAF: 'Saint Martin', SXM: 'Sint Maarten', BMU: 'Bermuda',
  };
  const country = countryNames[r.code];
  // Provinces/states of CAN/USA/MEX are 'region' rows; standalone countries too.
  const subdivided = r.code === 'CAN' || r.code === 'USA' || r.code === 'MEX';
  return {
    id: `reg-${r.code}-${r.name}`,
    name: r.name,
    kind: subdivided ? 'region' : 'country',
    area: subdivided ? country : '',
    lon: r.lon,
    lat: r.lat,
  } as Place;
});

export const SEARCH_PLACES: Place[] = [...CITIES, ...ALL_REGIONS];

const KIND_RANK: Record<PlaceKind, number> = { city: 0, region: 1, country: 2 };

/** Rank a query against the combined place index; returns the best 7. */
export function searchPlaces(query: string, limit = 7): Place[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const scored: { place: Place; score: number }[] = [];
  for (const place of SEARCH_PLACES) {
    const name = place.name.toLowerCase();
    const area = place.area.toLowerCase();
    let s = -1;
    if (name === q) s = 0;
    else if (name.startsWith(q)) s = 1 + name.length / 1000;
    else if (name.includes(q)) s = 4 + name.indexOf(q) / 100;
    else if (area && area.includes(q)) s = 7 + area.indexOf(q) / 100;
    if (s < 0) continue;
    scored.push({ place, score: s * 10 + KIND_RANK[place.kind] });
  }
  scored.sort((a, b) => a.score - b.score);
  return scored.slice(0, limit).map((x) => x.place);
}
