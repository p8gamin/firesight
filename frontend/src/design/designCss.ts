import { useEffect } from 'react';
import { isWeb } from './platform';

/**
 * CSS injected on web only. Mirrors the original MotionSites stylesheet:
 * entrance keyframes (blur-rise reveal, fade-up, Ken Burns zoom), the
 * reduced-motion escape hatch, backdrop blur for the nav pill and hover /
 * active states that pure CSS handles better than inline styles.
 *
 * Colors and fonts themselves stay in the RN style objects; this stylesheet
 * only adds what RN can't express.
 */
export const DESIGN_CSS = `
html, body, #root {
  background: #000;
  margin: 0;
  min-height: 100%;
}
/*
 * Expo's default reset (expo-reset in index.html) pins html/body/#root to
 * height:100% so apps scroll internally. The hero page is designed to scroll
 * as a whole (hero → scroll-jack gallery → outro), so it opts the document
 * back out of that fixed height while it is mounted: HeroScreen adds the
 * 'fs-hero-scroll' class to <html> and <body>, and every rule below is
 * scoped to that class. Screens like the map and alerts never add the class,
 * so #root keeps expo's full-height reset and their flex chains resolve.
 */
html.fs-hero-scroll {
  height: auto !important;
  min-height: 100%;
  overflow-y: auto !important;
  overflow-x: hidden !important;
}
html.fs-hero-scroll #root {
  height: auto !important;
}
/* Body grows with the content and never creates its own scroll container.
 * overflow-x: clip (rather than hidden) keeps the wide filmstrip from
 * leaking sideways without forcing overflow-y on body to auto. */
html.fs-hero-scroll body {
  overflow-x: clip !important;
  overflow-y: visible !important;
  height: auto !important;
}
body {
  -webkit-font-smoothing: antialiased;
}

/* --- Entrance choreography (identical values to the template) --- */
@keyframes heroReveal {
  0%   { opacity: 0; transform: translateY(28px); filter: blur(12px); }
  100% { opacity: 1; transform: translateY(0);    filter: blur(0); }
}
@keyframes heroFadeUp {
  0%   { opacity: 0; transform: translateY(20px); }
  100% { opacity: 1; transform: translateY(0); }
}
@keyframes heroZoom {
  0%   { transform: scale(1.12); }
  100% { transform: scale(1); }
}
.hero-anim {
  opacity: 0;
  animation-fill-mode: forwards;
  animation-timing-function: cubic-bezier(0.16, 1, 0.3, 1);
}
.hero-reveal { animation-name: heroReveal; animation-duration: 1.1s; }
.hero-fade   { animation-name: heroFadeUp; animation-duration: 1s; }
.hero-zoom   { animation: heroZoom 1.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
@media (prefers-reduced-motion: reduce) {
  .hero-anim, .hero-zoom { animation: none; opacity: 1; }
  /* FlowButton: snap to the hovered state instead of animating. */
  .cd-flowbtn, .cd-flowbtn * { transition: none !important; }
}

/* --- Interactive states --- */
.cd-click { cursor: pointer; }
.cd-blur {
  -webkit-backdrop-filter: blur(14px);
  backdrop-filter: blur(14px);
}
.cd-nav-item {
  /* Color is set inline per active state; this eases the flip. */
  transition: color 300ms ease;
}
/* Sliding pill behind the hovered/active nav item (AnimatedBackground). */
.cd-nav-highlight { background: #fff; }
/*
 * FlowButton (Sign Up / Get Started). Resting: white pill with dark text.
 * On hover the border-radius relaxes to 12px and a dark circle expands from
 * the center, inverting text + arrows to white. Transitions mirror the
 * original template: 600ms button, 800ms arrows/text, bouncy beziers.
 */
.cd-flowbtn {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  overflow: hidden;
  border-radius: 100px;
  border: 1.5px solid rgba(51, 51, 51, 0.4);
  background-color: #fff;
  padding: 12px 32px;
  font-size: 14px;
  font-weight: 600;
  color: #111827;
  cursor: pointer;
  transition: all 600ms cubic-bezier(0.23, 1, 0.32, 1);
}
.cd-flowbtn:hover {
  border-color: transparent;
  color: #ffffff;
  border-radius: 12px;
}
.cd-flowbtn:active { transform: scale(0.95); }
.cd-flowbtn-arrow {
  position: absolute;
  width: 16px;
  height: 16px;
  stroke: #111827;
  fill: none;
  z-index: 9;
  transition: all 800ms cubic-bezier(0.34, 1.56, 0.64, 1);
}
.cd-flowbtn-arrow-left { left: -25%; }
.cd-flowbtn-arrow-right { right: 16px; }
.cd-flowbtn:hover .cd-flowbtn-arrow-left { left: 16px; stroke: #ffffff; }
.cd-flowbtn:hover .cd-flowbtn-arrow-right { right: -25%; stroke: #ffffff; }
.cd-flowbtn-text {
  position: relative;
  z-index: 1;
  transform: translateX(-12px);
  transition: all 800ms ease-out;
}
.cd-flowbtn:hover .cd-flowbtn-text { transform: translateX(12px); }
.cd-flowbtn-circle {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 16px;
  height: 16px;
  background-color: #111827;
  border-radius: 50%;
  opacity: 0;
  transition: all 800ms cubic-bezier(0.19, 1, 0.22, 1);
}
.cd-flowbtn:hover .cd-flowbtn-circle {
  width: 220px;
  height: 220px;
  opacity: 1;
}
.cd-dig {
  background-color: #e8702a;
  color: #fff;
  transition: background-color 180ms ease-out, transform 160ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 200ms ease-out;
}
.cd-dig:hover {
  background-color: #d2611f;
  transform: scale(1.03);
  box-shadow: 0 14px 34px -8px rgba(232, 112, 42, 0.5);
}
.cd-dig:active { transform: scale(0.95); }
.cd-nav-item:focus-visible,
.cd-flowbtn:focus-visible,
.cd-dig:focus-visible,
.cd-glass:focus-visible {
  outline: 2px solid rgba(255, 255, 255, 0.7);
  outline-offset: 2px;
}

/* --- Liquid-glass nav pills (LiquidGlassNavItem.web.tsx) ---
 * Frosted-glass capsules translated from the "Liquid Glass" button
 * reference: a translucent white gradient body with backdrop blur behind it,
 * plus a layered box-shadow stack that sculpts the glass edge — bright
 * bottom-right inner bevel, faint top-left catch light, thin white veil
 * across the body, and a soft outer drop shadow + glow. Hover lifts and
 * brightens the glass; the selected pill is the most saturated; pressing
 * pushes the pill in. */
.cd-glass {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  cursor: pointer;
  padding: 6px 18px;
  border-radius: 100px;
  background-color: rgba(14, 18, 23, 0.18);
  background-image: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.16) 0%,
    rgba(255, 255, 255, 0.06) 45%,
    rgba(255, 255, 255, 0.02) 100%
  );
  -webkit-backdrop-filter: blur(18px) saturate(160%);
  backdrop-filter: blur(18px) saturate(160%);
  box-shadow:
    0 0 8px rgba(0, 0, 0, 0.06),
    0 2px 6px rgba(0, 0, 0, 0.16),
    inset 3px 3px 0.5px -3.5px rgba(255, 255, 255, 0.14),
    inset -3px -3px 0.5px -3.5px rgba(255, 255, 255, 0.42),
    inset 1px 1px 1px -0.5px rgba(255, 255, 255, 0.34),
    inset -1px -1px 1px -0.5px rgba(255, 255, 255, 0.3),
    inset 0 0 6px 6px rgba(255, 255, 255, 0.05),
    0 0 14px rgba(255, 255, 255, 0.06);
  transition:
    transform 250ms cubic-bezier(0.1, 0.4, 0.2, 1),
    box-shadow 250ms cubic-bezier(0.1, 0.4, 0.2, 1),
    background-color 250ms ease-out,
    background-image 250ms ease-out;
}
.cd-glass-label {
  position: relative;
  font-size: 14px;
  line-height: 20px;
  color: rgba(255, 255, 255, 0.78);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.55);
  white-space: nowrap;
  transition: color 200ms ease-out;
}
.cd-glass:hover {
  transform: translateY(-1px);
  background-color: rgba(24, 30, 37, 0.22);
  background-image: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.24) 0%,
    rgba(255, 255, 255, 0.1) 45%,
    rgba(255, 255, 255, 0.05) 100%
  );
  box-shadow:
    0 0 10px rgba(0, 0, 0, 0.08),
    0 4px 10px rgba(0, 0, 0, 0.2),
    inset 3px 3px 0.5px -3.5px rgba(255, 255, 255, 0.2),
    inset -3px -3px 0.5px -3.5px rgba(255, 255, 255, 0.55),
    inset 1px 1px 1px -0.5px rgba(255, 255, 255, 0.45),
    inset -1px -1px 1px -0.5px rgba(255, 255, 255, 0.4),
    inset 0 0 6px 6px rgba(255, 255, 255, 0.08),
    0 0 18px rgba(255, 255, 255, 0.14);
}
.cd-glass:active {
  transform: translateY(1px) scale(0.97);
}
.cd-glass-active {
  background-color: rgba(34, 42, 50, 0.28);
  background-image: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.3) 0%,
    rgba(255, 255, 255, 0.14) 45%,
    rgba(255, 255, 255, 0.06) 100%
  );
  box-shadow:
    0 0 10px rgba(0, 0, 0, 0.08),
    0 3px 8px rgba(0, 0, 0, 0.18),
    inset 3px 3px 0.5px -3.5px rgba(255, 255, 255, 0.24),
    inset -3px -3px 0.5px -3.5px rgba(255, 255, 255, 0.6),
    inset 1px 1px 1px -0.5px rgba(255, 255, 255, 0.5),
    inset -1px -1px 1px -0.5px rgba(255, 255, 255, 0.45),
    inset 0 0 0 1px rgba(255, 255, 255, 0.18),
    0 0 22px rgba(255, 255, 255, 0.2);
}
.cd-glass:hover .cd-glass-label,
.cd-glass-active .cd-glass-label {
  color: #ffffff;
}

/* --- Animated floating nav (AnimatedNavFramer.web.tsx) ---
 * The framer-motion capsule: a translucent dark body with backdrop blur and
 * a hairline light ring, so it reads as a pill of glass floating over the
 * hero photo. Framer-motion animates width / opacity / transform inline;
 * this stylesheet only adds the static glass look, the hover state of the
 * section links, and the collapsed-state helpers. The top-left FireSight
 * brand and the Get Started CTA are shown on md+ (like the old NavBar's
 * pills); on smaller widths they are hidden so they can never collide with
 * the centered capsule. */
.cd-nav-brand,
.cd-nav-cta {
  display: flex;
}
@media (max-width: 767.98px) {
  .cd-nav-brand,
  .cd-nav-cta {
    display: none;
  }
}
.cd-animated-nav {
  background-color: rgba(13, 17, 22, 0.78);
  border: 1px solid rgba(255, 255, 255, 0.14);
  -webkit-backdrop-filter: blur(16px) saturate(150%);
  backdrop-filter: blur(16px) saturate(150%);
  box-shadow:
    0 8px 24px -6px rgba(0, 0, 0, 0.5),
    0 2px 6px rgba(0, 0, 0, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
}
.cd-animated-nav-collapsed {
  justify-content: center;
  cursor: pointer;
}
.cd-animated-nav-links {
  gap: 4px;
}
@media (min-width: 640px) {
  .cd-animated-nav-links {
    gap: 16px;
  }
}
.cd-animated-nav-links.is-collapsed {
  pointer-events: none;
}
.cd-animated-nav-link {
  color: rgba(255, 255, 255, 0.72);
  cursor: pointer;
  text-decoration: none;
  transition: color 300ms ease;
}
.cd-animated-nav-link:hover {
  color: #ffffff;
}
.cd-animated-nav-link-active {
  color: #ffffff;
  background-color: rgba(255, 255, 255, 0.14);
  border-radius: 999px;
}
.cd-animated-nav-link:focus-visible {
  outline: 2px solid rgba(255, 255, 255, 0.7);
  outline-offset: 2px;
}
@media (prefers-reduced-motion: reduce) {
  .cd-glass {
    transition: none;
  }
  .cd-animated-nav,
  .cd-animated-nav-link {
    transition: none !important;
  }
}

/* ================================================================
 * FireSight shiny brand button (web).
 *
 * The top-left FireSight logo + wordmark rendered as a compact pill with
 * the rotating conic-gradient shine, themed to the FireSight palette:
 * deep forest green base with an ember-orange highlight sweeping around
 * the border. Uses Houdini @property so the angle/percent interpolate
 * smoothly; browsers without @property fall back to a static ring.
 * ================================================================ */
@property --fs-shine-angle {
  syntax: "<angle>";
  initial-value: 0deg;
  inherits: false;
}

@property --fs-shine-offset {
  syntax: "<angle>";
  initial-value: 0deg;
  inherits: false;
}

@property --fs-shine-percent {
  syntax: "<percentage>";
  initial-value: 5%;
  inherits: false;
}

@property --fs-shine-color {
  syntax: "<color>";
  initial-value: #f2b98a;
  inherits: false;
}

.fs-shiny-brand {
  --fs-brand-bg: #000000;
  --fs-brand-bg-subtle: #161616;
  --fs-brand-fg: #ffffff;
  --fs-brand-highlight: #ed8c49;
  --fs-brand-highlight-subtle: #f2b98a;
  --fs-duration: 4s;
  --fs-transition: 800ms cubic-bezier(0.25, 1, 0.5, 1);

  isolation: isolate;
  position: relative;
  overflow: hidden;
  cursor: pointer;
  outline-offset: 4px;
  padding: 0.5rem 1.1rem;
  font-family: "Inter_500Medium", "Inter", sans-serif;
  font-size: 1rem;
  line-height: 1.2;
  font-weight: 500;
  border: 1px solid transparent;
  border-radius: 360px;
  color: var(--fs-brand-fg);
  background: linear-gradient(var(--fs-brand-bg), var(--fs-brand-bg)) padding-box,
    conic-gradient(
      from calc(var(--fs-shine-angle) - var(--fs-shine-offset)),
      transparent,
      var(--fs-brand-highlight) var(--fs-shine-percent),
      var(--fs-shine-color) calc(var(--fs-shine-percent) * 2),
      var(--fs-brand-highlight) calc(var(--fs-shine-percent) * 3),
      transparent calc(var(--fs-shine-percent) * 4)
    ) border-box;
  box-shadow: inset 0 0 0 1px var(--fs-brand-bg-subtle);
  transition: var(--fs-transition);
  transition-property: --fs-shine-offset, --fs-shine-percent, --fs-shine-color;
}

.fs-shiny-brand::before,
.fs-shiny-brand::after,
.fs-shiny-brand > span::before {
  content: "";
  pointer-events: none;
  position: absolute;
  inset-inline-start: 50%;
  inset-block-start: 50%;
  translate: -50% -50%;
  z-index: -1;
}

.fs-shiny-brand:active {
  translate: 0 1px;
}

/* Dots pattern */
.fs-shiny-brand::before {
  --size: calc(100% - 6px);
  --position: 2px;
  --space: calc(var(--position) * 2);
  width: var(--size);
  height: var(--size);
  background: radial-gradient(
    circle at var(--position) var(--position),
    rgba(255, 255, 255, 0.85) calc(var(--position) / 4),
    transparent 0
  ) padding-box;
  background-size: var(--space) var(--space);
  background-repeat: space;
  mask-image: conic-gradient(
    from calc(var(--fs-shine-angle) + 45deg),
    black,
    transparent 10% 90%,
    black
  );
  border-radius: inherit;
  opacity: 0.28;
  z-index: -1;
}

/* Inner shimmer */
.fs-shiny-brand::after {
  width: 100%;
  aspect-ratio: 1;
  background: linear-gradient(
    -50deg,
    transparent,
    var(--fs-brand-highlight),
    transparent
  );
  mask-image: radial-gradient(circle at bottom, transparent 40%, black);
  opacity: 0.5;
}

.fs-shiny-brand > span {
  z-index: 1;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  white-space: nowrap;
}

.fs-shiny-brand > span::before {
  --size: calc(100% + 1rem);
  width: var(--size);
  height: var(--size);
  box-shadow: inset 0 -1ex 2rem 4px var(--fs-brand-highlight);
  opacity: 0;
  transition: opacity var(--fs-transition);
  animation: calc(var(--fs-duration) * 1.5) fs-breathe linear infinite;
}

/* Rotate the shine continuously; the second (paused, reversed) layer is
 * kept for the same layered-composition feel as the reference. */
.fs-shiny-brand,
.fs-shiny-brand::before,
.fs-shiny-brand::after {
  animation: fs-gradient-angle var(--fs-duration) linear infinite,
    fs-gradient-angle calc(var(--fs-duration) / 0.4) reverse paused;
  animation-composition: add;
}

.fs-shiny-brand:is(:hover, :focus-visible) {
  --fs-shine-percent: 20%;
  --fs-shine-offset: 95deg;
  --fs-shine-color: var(--fs-brand-highlight-subtle);
}

.fs-shiny-brand:is(:hover, :focus-visible),
.fs-shiny-brand:is(:hover, :focus-visible)::before,
.fs-shiny-brand:is(:hover, :focus-visible)::after {
  animation-play-state: running;
}

.fs-shiny-brand:is(:hover, :focus-visible) > span::before {
  opacity: 1;
}

.fs-shiny-brand-logo {
  height: 24px;
  width: auto;
  object-fit: contain;
  display: block;
}

@keyframes fs-gradient-angle {
  to {
    --fs-shine-angle: 360deg;
  }
}

@keyframes fs-breathe {
  from, to {
    scale: 1;
  }
  50% {
    scale: 1.2;
  }
}

@media (prefers-reduced-motion: reduce) {
  .fs-shiny-brand,
  .fs-shiny-brand::before,
  .fs-shiny-brand::after,
  .fs-shiny-brand > span::before {
    animation: none !important;
    transition: none !important;
  }
}
`;

const STYLE_ID = 'motionsites-design-css';

/** Injects DESIGN_CSS once into the document head (no-op on native). */
export function useDesignStyles() {
  useEffect(() => {
    if (!isWeb || typeof document === 'undefined') return;
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = DESIGN_CSS;
    document.head.appendChild(style);
  }, []);
}
