/**
 * Design tokens + copy for the FireSight hero. Values follow the Emil
 * design-eng guidance: a near-monochrome palette with one ember accent, and
 * copy set in Inter (medium headlines + wordmark, regular body) so the
 * message reads in a single voice.
 */

export const BG_IMAGE_1 =
  'https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260609_195923_b0ba8ace-1d1d-4f2c-9a28-1ab84b330680.png&w=1280&q=85';

export const BG_IMAGE_2 =
  'https://cdn.phototourl.com/free/2026-09-04-5a2ddefc-8821-48b1-b4e5-da29a7d8a8e5.jpg';

/** Radius (px) of the cursor-following spotlight that reveals BG_IMAGE_2. */
export const SPOTLIGHT_RADIUS = 260;

/**
 * Extra imagery for the outro image stream (the corridor below the
 * horizontal gallery). Appended after the gallery-card images.
 */
export const STREAM_EXTRA_IMAGES: { src: string; alt: string }[] = [
  {
    src: 'https://upload.wikimedia.org/wikipedia/commons/0/05/Burnout_ops_on_Mangum_Fire_McCall_Smokejumpers.jpg',
    alt: 'Burnout operations on the Mangum Fire by the McCall Smokejumpers',
  },
  {
    src: 'https://walrus-assets.s3.amazonaws.com/img/Winter_QA_1800.jpg',
    alt: 'Wildfire scene',
  },
  {
    src: 'https://news.northeastern.edu/wp-content/uploads/2025/01/wildfire_1400.jpg',
    alt: 'Wildfire scene',
  },
];

/**
 * One card in the horizontal gallery section. `image` is optional — items
 * without an image render a gradient block in `color` instead, so the
 * section looks intentional before you drop in your own URLs.
 */
export interface GalleryItem {
  id: number;
  label: string;
  caption: string;
  /** Optional image URL. Omit to render a colored gradient placeholder. */
  image?: string;
  /** Accent color: gradient placeholder + number text. */
  color: string;
}

/**
 * Gallery items, in display order. Swap `image` / `label` / `caption` freely.
 * The first item ships with a real image so the section renders immediately.
 */
export const GALLERY_ITEMS: GalleryItem[] = [
  {
    id: 1,
    label: '70,000+ wildfires',
    caption: 'Across North America each year',
    image:
      'https://cdn.phototourl.com/free/2026-09-05-2cbd1a56-a287-40a2-a67c-e5ac3566e7fc.jpg',
    color: '#e8702a',
  },
  {
    id: 2,
    label: '5.1M+',
    caption: 'acres burned by wildfires across the US in 2025',
    image:
      'https://www.propublica.org/wp-content/uploads/2020/09/20200918-fire-01-3000x2000.jpg?w=1149',
    color: '#e8702a',
  },
  {
    id: 3,
    label: 'NOAA-20/21 VIIRS',
    caption: 'Live satellite data reveals heat anomalies',
    image:
      'https://upload.wikimedia.org/wikipedia/commons/9/9a/Artist%27s_rendering_of_NOAA-21.png?utm_source=en.wikipedia.org&utm_campaign=index&utm_content=original',
    color: '#e8702a',
  },
  {
    id: 4,
    label: 'Fire Intelligence',
    caption: 'Live statistics, track its spread',
    image:
      'https://cdn.phototourl.com/free/2026-09-05-6888fb07-20d4-4e96-8d03-375fef03218a.jpg',
    color: '#e8702a',
  },
  {
    id: 5,
    label: 'Stay Ahead',
    caption: "Know what's happening",
    image:
      'https://cdn.phototourl.com/free/2026-09-05-a49d05e5-4fd6-4dd7-ac99-c8a26b48b035.jpg',
    color: '#e8702a',
  },
];

/** Breakpoints mirroring Tailwind's sm / md minimum widths. */
export const BP_SM = 640;
export const BP_MD = 768;

/**
 * Registered font family keys — these match the keys passed to useFonts in
 * app/_layout.tsx, so the same string works on every platform.
 */
export const FONT = {
  /** Inter (body / UI). */
  interRegular: 'Inter_400Regular',
  interMedium: 'Inter_500Medium',
  interSemiBold: 'Inter_600SemiBold',
  /** Playfair Display italic — kept loaded for legacy screens, not used by current FireSight copy. */
  playfairItalic: 'PlayfairDisplay_400Regular_Italic',
} as const;

export const COLOR = {
  white: '#ffffff',
  white80: 'rgba(255,255,255,0.8)',
  white60: 'rgba(255,255,255,0.6)',
  white30: 'rgba(255,255,255,0.3)',
  white20: 'rgba(255,255,255,0.2)',
  gray900: '#111827',
  gray100: '#f3f4f6',
  /** Ember accent used by the primary CTA. */
  accent: '#e8702a',
  accentHover: '#d2611f',
} as const;

export const COPY = {
  headingLine1: 'See Fire.',
  headingLine2: 'Before it Spreads',
  cta: 'Start Digging',
  wordmark: 'FireSight',
  nav: {
    home: 'Home',
    map: 'Map',
    alerts: 'Alerts',
    locations: 'Locations',
    about: 'About',
    signUp: 'Get Started',
  },
} as const;

/** Navigation items in order. The five FireSight destinations. */
export const NAV_ITEMS = [
  { label: COPY.nav.home, active: true },
  { label: COPY.nav.map, active: false },
  { label: COPY.nav.alerts, active: false },
  { label: COPY.nav.locations, active: false },
  { label: COPY.nav.about, active: false },
] as const;