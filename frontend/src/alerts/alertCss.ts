import { useEffect } from 'react';
import { isWeb } from '../design/platform';

/**
 * Web-only CSS for the FireSight Alerts screen. Layout, colors and typography
 * live in RN style objects; this stylesheet adds the handful of effects RN
 * can't express: backdrop blur on the filter bar, card hover lift, filter
 * hover/brightness, and their reduced-motion / touch guards.
 *
 * Injected once by useAlertStyles() (no-op on native).
 */
export const ALERT_CSS = `
/* Frosted surface (filter bar, floating panels). */
.al-blur {
  -webkit-backdrop-filter: blur(18px) saturate(150%);
  backdrop-filter: blur(18px) saturate(150%);
}

/* Alert card — bento-derived resting state plus a quiet hover lift and an
 * inset ember glow that echoes the reference card's inset highlight. */
.al-card {
  transition:
    transform 260ms cubic-bezier(0.16, 1, 0.3, 1),
    border-color 200ms ease,
    box-shadow 260ms ease;
}
@media (hover: hover) and (pointer: fine) {
  .al-card:hover {
    transform: translateY(-2px);
    border-color: rgba(255, 255, 255, 0.2);
    box-shadow:
      0 22px 44px -22px rgba(0, 0, 0, 0.8),
      0 0 0 1px rgba(255, 255, 255, 0.05),
      inset 0 -48px 64px -48px rgba(237, 140, 73, 0.18);
  }
}

/* Interactive rows / chips / links. Hover gated to precise pointers so a
 * phone tap never leaves a sticky hover. */
.al-tap {
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition:
    filter 180ms ease-out,
    background-color 180ms ease-out,
    border-color 180ms ease-out,
    color 180ms ease-out,
    opacity 180ms ease-out;
}
@media (hover: hover) and (pointer: fine) {
  .al-tap:hover {
    filter: brightness(1.16);
  }
}

/* Keyboard focus is never hidden. */
.al-tap:focus-visible,
.al-card:focus-within {
  outline: 2px solid rgba(255, 255, 255, 0.72);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .al-card,
  .al-tap {
    transition: none !important;
  }
}
`;

const STYLE_ID = 'firesight-alerts-css';

/** Injects ALERT_CSS once into the document head (no-op on native). */
export function useAlertStyles() {
  useEffect(() => {
    if (!isWeb || typeof document === 'undefined') return;
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = ALERT_CSS;
    document.head.appendChild(style);
  }, []);
}