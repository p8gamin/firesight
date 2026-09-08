import { useEffect } from 'react';
import { isWeb } from '../design/platform';

/**
 * Web-only CSS for the FireSight map screen. Layout, colors and typography
 * live in RN style objects; this stylesheet adds the handful of effects RN
 * can't express: backdrop blur on glass surfaces, hover/brightness feedback,
 * grab cursor on the map canvas, and their reduced-motion / touch guards.
 *
 * Injected once by useMapStyles() (no-op on native).
 */
export const MAP_CSS = `
/* The map canvas pans with the pointer — grab / grabbing cursors. */
.cm-canvas {
  cursor: grab;
  touch-action: none;
}
.cm-canvas.is-panning {
  cursor: grabbing;
}
.cm-canvas * {
  touch-action: none;
}

/* Glass surfaces: backdrop blur is applied only when the browser supports it;
 * the tinted background is always set inline so native falls back cleanly. */
.cm-blur {
  -webkit-backdrop-filter: blur(18px) saturate(150%);
  backdrop-filter: blur(18px) saturate(150%);
}
.cm-blur-sm {
  -webkit-backdrop-filter: blur(14px) saturate(140%);
  backdrop-filter: blur(14px) saturate(140%);
}

/* Interactive feedback for chips / icon buttons / rows / links. Hover is
 * gated to precise pointers so a phone tap never leaves a sticky hover. */
.cm-tap {
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition:
    filter 200ms ease-out,
    opacity 200ms ease-out,
    background-color 180ms ease-out;
}
@media (hover: hover) and (pointer: fine) {
  .cm-tap:hover {
    filter: brightness(1.22);
  }
  .cm-brand-link:hover {
    opacity: 0.82;
  }
  .cm-suggest-row:hover {
    background-color: rgba(255, 255, 255, 0.08);
  }
  .cm-fire-card:hover {
    box-shadow: 0 22px 48px -18px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(255, 255, 255, 0.14);
  }
}

.cm-brand-link {
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: opacity 200ms ease-out;
}

.cm-suggest-row {
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: background-color 160ms ease-out;
}

/* Keyboard focus is never hidden. */
.cm-tap:focus-visible,
.cm-brand-link:focus-visible,
.cm-suggest-row:focus-visible {
  outline: 2px solid rgba(255, 255, 255, 0.72);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .cm-tap {
    transition: none;
  }
}
`;

const STYLE_ID = 'firesight-map-css';

/** Injects MAP_CSS once into the document head (no-op on native). */
export function useMapStyles() {
  useEffect(() => {
    if (!isWeb || typeof document === 'undefined') return;
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = MAP_CSS;
    document.head.appendChild(style);
  }, []);
}
