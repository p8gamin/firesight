import { motion, useMotionValue, useScroll, useTransform } from 'motion/react';
import { useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import { GALLERY_ITEMS } from './constants';
import ImageStreamHero, { type StreamImage } from './ImageStreamHero.web';
import { STREAM_EXTRA_IMAGES } from './constants';

/**
 * FireSight image gallery (web only).
 *
 * A horizontal row of five image cards below the hero, driven by vertical
 * scroll: a tall scroll track with a sticky viewport, and a filmstrip whose
 * position follows scroll progress CONTINUOUSLY (no snapping while you
 * scroll — it moves freely with the wheel). Clicking an image snaps the row
 * to it: the page smooth-scrolls to the progress point where that card sits
 * centered, so the filmstrip glides exactly to the image you picked.
 *
 * The first card starts centered with the next card peeking in on the right.
 * Each card shows its `image` (background-cover); cards without a photo
 * render a neutral dashed frame labelled "Image 1…5" ready for a URL in
 * GALLERY_ITEMS.
 *
 * Horizontal scrolling is disabled entirely (`overflow-x: hidden`/`clip`),
 * so the only scroll axis is vertical.
 *
 * This file is raw DOM + CSS (not react-native-web) because the effect needs
 * `position: sticky` and window scroll progress. The native twin lives in
 * ScrollGallery.tsx (horizontal paging ScrollView).
 */

const SLIDES = GALLERY_ITEMS.length;

/**
 * Corridor stream: the same imagery as the gallery cards, in order,
 * followed by the extra stream images from constants.
 */
const STREAM_IMAGES: StreamImage[] = [
  ...GALLERY_ITEMS.flatMap((item) =>
    item.image ? [{ src: item.image, alt: item.label }] : [],
  ),
  ...STREAM_EXTRA_IMAGES,
];

const GALLERY_CSS = `
/* Horizontal scrolling is disabled everywhere — vertical scroll only.
 * html clips the document horizontally; body overflow is handled in
 * designCss (clip) so it never becomes its own scroll container. */
html {
  overflow-x: hidden !important;
}

#sg {
  /* One image per ~0.55 of a viewport scroll, so moving through all five
   * takes a little deliberate scrolling: height = ((N-1) * 0.55 + 1) screens. */
  height: ${((SLIDES - 1) * 0.55 + 1) * 100}vh;
  /* Stop RNW flex ancestors from compressing the tall track. */
  flex-shrink: 0;
  overflow: visible;
  overflow-x: clip;
  background: #000;
  --card-w: min(84vw, 920px);
}

/* --- The scroll track + pinned viewport --- */
.sg-scroll-container {
  height: 100%;
  position: relative;
  overflow-x: clip;
}
.sg-sticky-wrapper {
  position: sticky;
  top: 0;
  height: 100vh;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  overflow-x: clip;
  overflow-y: visible;
}

/* --- The translating filmstrip of image cards --- */
.sg-gallery {
  display: flex;
  align-items: center;
  gap: clamp(18px, 3vw, 44px);
  /* Centres the first card; scroll progress slides one card over at a time. */
  margin-left: calc((100vw - var(--card-w)) / 2);
  will-change: transform;
}

/* --- One image box (click to snap to it) --- */
.sg-item {
  flex-shrink: 0;
  width: var(--card-w);
  margin: 0;
  display: flex;
  flex-direction: column;
  cursor: pointer;
  outline: none;
}
.sg-item:focus-visible .sg-item-image {
  outline: 2px solid rgba(255, 255, 255, 0.7);
  outline-offset: 3px;
}
.sg-item-image {
  position: relative;
  width: 100%;
  height: clamp(240px, 58vh, 600px);
  border-radius: 18px;
  background-size: cover;
  background-position: center;
  box-shadow:
    0 2px 6px rgba(0, 0, 0, 0.35),
    0 18px 40px -18px rgba(0, 0, 0, 0.7);
  transition: box-shadow 200ms ease-out;
}
.sg-item:hover .sg-item-image {
  box-shadow:
    0 2px 6px rgba(0, 0, 0, 0.35),
    0 18px 40px -18px rgba(0, 0, 0, 0.7),
    0 0 0 1px rgba(255, 255, 255, 0.18),
    0 0 28px rgba(232, 112, 42, 0.18);
}
/* Photo box */
.sg-item-image--photo {
  background-color: var(--item-color, #161a1f);
  background-image: var(--item-image, linear-gradient(160deg, var(--item-color, #161a1f), #0a0d10 82%));
}
/* Empty frame: neutral placeholder ready for the user's own photo */
.sg-item-image--slot {
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(180deg, #1a1f26 0%, #10141a 100%);
  border: 1.5px dashed rgba(255, 255, 255, 0.28);
  border-radius: 18px;
}
.sg-item-slot-label {
  font-size: 13px;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.55);
  font-family: 'Inter_600SemiBold', sans-serif;
  user-select: none;
}

/* --- Caption under the box --- */
.sg-item-caption {
  padding: 14px 4px 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.sg-item-number {
  font-size: 11px;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  color: var(--item-color, #e8702a);
  font-family: 'Inter_600SemiBold', sans-serif;
  display: block;
}
.sg-item-label {
  font-size: clamp(20px, 2.4vw, 28px);
  font-weight: 600;
  line-height: 1.15;
  letter-spacing: -0.01em;
  color: #ffffff;
  font-family: 'Inter_600SemiBold', sans-serif;
  margin: 0;
}
.sg-item-text {
  font-size: 13px;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.6);
  font-family: 'Inter_400Regular', sans-serif;
  margin: 0;
}

/* --- Outro: wordmark + byline above the image corridor --- */
.sg-outro {
  background: #000;
}
.sg-corridor {
  height: clamp(560px, 92vh, 880px);
}
.sg-outro-head {
  position: relative;
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 128px 24px 0;
  text-align: center;
  pointer-events: none;
}
.sg-wordmark {
  font-size: clamp(36px, 5vw, 56px);
  color: #ffffff;
  font-family: 'Inter_500Medium', sans-serif;
  margin: 0;
  letter-spacing: -0.02em;
}
.sg-byline {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  letter-spacing: 0.01em;
  color: rgba(255, 255, 255, 0.45);
  font-family: 'Inter_400Regular', sans-serif;
}

/* Reduced motion: stack the cards vertically instead of scroll-jacking. */
@media (prefers-reduced-motion: reduce) {
  #sg {
    height: auto;
  }
  .sg-scroll-container {
    height: auto;
  }
  .sg-sticky-wrapper {
    position: relative;
    height: auto;
    width: 100%;
  }
  .sg-gallery {
    flex-direction: column;
    align-items: stretch;
    margin-left: 0;
    padding: 40px 24px;
    transform: none !important;
  }
  .sg-item {
    width: 100%;
  }
}
`;

export default function ScrollGallery() {
  const containerRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  });

  // Filmstrip follows scroll progress continuously — free, no snapping.
  const distance = useMotionValue(0); // total travel: (N-1) cards + gaps, in px
  const x = useTransform(() => -scrollYProgress.get() * distance.get());

  useEffect(() => {
    const container = containerRef.current;
    const item = container?.querySelector<HTMLElement>('.sg-item');
    const gallery = container?.querySelector<HTMLElement>('.sg-gallery');
    if (!item || !gallery) return;

    const measure = () => {
      const gap = parseFloat(getComputedStyle(gallery).gap || '0') || 0;
      distance.set((SLIDES - 1) * (item.offsetWidth + gap));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(item);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [distance]);

  // Click an image → smooth-scroll the page to the progress point where that
  // card is centered. That is the only "snap".
  const handlePick = (index: number) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const startY = rect.top + window.scrollY;
    const range = rect.height - window.innerHeight;
    if (range <= 0) return;
    const targetY = startY + (index / (SLIDES - 1)) * range;
    window.scrollTo({ top: targetY, behavior: 'smooth' });
  };

  return (
    <div id="sg">
      <div ref={containerRef} className="sg-scroll-container">
        <div className="sg-sticky-wrapper">
          <motion.div className="sg-gallery" style={{ x }}>
            {GALLERY_ITEMS.map((item, i) => (
              <figure
                key={item.id}
                className="sg-item"
                role="button"
                tabIndex={0}
                aria-label={`Show ${item.label}`}
                onClick={() => handlePick(i)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handlePick(i);
                  }
                }}
                style={
                  {
                    '--item-color': item.color,
                    ...(item.image ? { '--item-image': `url(${item.image})` } : {}),
                  } as CSSProperties
                }
              >
                {item.image ? (
                  <div className="sg-item-image sg-item-image--photo" />
                ) : (
                  <div className="sg-item-image sg-item-image--slot">
                    <span className="sg-item-slot-label">Image {item.id}</span>
                  </div>
                )}
                <figcaption className="sg-item-caption">
                  <span className="sg-item-number">0{item.id}</span>
                  <p className="sg-item-label">{item.label}</p>
                  <p className="sg-item-text">{item.caption}</p>
                </figcaption>
              </figure>
            ))}
          </motion.div>
        </div>
      </div>

      <section className="sg-outro">
        <ImageStreamHero
          images={STREAM_IMAGES}
          className="sg-corridor"
          axis={52}
        >
          <div className="sg-outro-head">
            <p className="sg-wordmark">FireSight</p>
            <p className="sg-byline">A project by Krishnavivek Ivaturi.</p>
          </div>
        </ImageStreamHero>
      </section>

      <style>{GALLERY_CSS}</style>
    </div>
  );
}
