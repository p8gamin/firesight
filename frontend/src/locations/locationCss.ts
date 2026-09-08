import { useEffect } from 'react';
import { isWeb } from '../design/platform';

/**
 * Web-only CSS for the FireSight Locations screens (list, add/edit flow,
 * detail, activity sheet). Layout, colors and typography live in RN style
 * objects; this stylesheet adds the effects RN can't express: backdrop blur,
 * card hover lift, tap brightness, focus outlines — with touch + reduced
 * motion guards. Injected once by useLocationStyles() (no-op on native).
 */
export const LOCATION_CSS = `
/* Frosted surfaces (filter bars, modal panels, sheets). */
.lc-blur {
  -webkit-backdrop-filter: blur(18px) saturate(150%);
  backdrop-filter: blur(18px) saturate(150%);
}

/* Location cards — quiet resting state, quiet hover lift (bento DNA). */
.lc-card {
  transition:
    transform 260ms cubic-bezier(0.16, 1, 0.3, 1),
    border-color 200ms ease,
    box-shadow 260ms ease;
}
@media (hover: hover) and (pointer: fine) {
  .lc-card:hover {
    transform: translateY(-2px);
    border-color: rgba(255, 255, 255, 0.2);
    box-shadow:
      0 22px 44px -22px rgba(0, 0, 0, 0.8),
      0 0 0 1px rgba(255, 255, 255, 0.05),
      inset 0 -48px 64px -48px rgba(237, 140, 73, 0.14);
  }
}

/* Interactive rows / chips / links. */
.lc-tap {
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
  .lc-tap:hover {
    filter: brightness(1.14);
  }
}

/* Timeline rows — row-level hover so events read as actionable. */
@media (hover: hover) and (pointer: fine) {
  .lc-event:hover {
    background-color: rgba(255, 255, 255, 0.035);
  }
}

/* Keyboard focus is never hidden. */
.lc-tap:focus-visible,
.lc-card:focus-within {
  outline: 2px solid rgba(255, 255, 255, 0.72);
  outline-offset: 2px;
}

/* The add/edit flow's radius track dots pulse gently on the active value. */
@keyframes lc-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(237, 140, 73, 0.35); }
  50% { box-shadow: 0 0 0 6px rgba(237, 140, 73, 0); }
}

@media (prefers-reduced-motion: reduce) {
  .lc-card,
  .lc-tap,
  .lc-event {
    transition: none !important;
  }
}
`;

const STYLE_ID = 'firesight-locations-css';

/** Injects LOCATION_CSS once into the document head (no-op on native). */
export function useLocationStyles() {
  useEffect(() => {
    if (!isWeb || typeof document === 'undefined') return;
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = LOCATION_CSS;
    document.head.appendChild(style);
  }, []);
}