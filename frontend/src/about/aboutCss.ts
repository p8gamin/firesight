import { useEffect } from 'react';
import { isWeb } from '../design/platform';

/**
 * Web-only CSS for the FireSight About screen: frosted surfaces and tap
 * states (hover gated to precise pointers, focus never hidden, reduced
 * motion respected). Layout/typography live in RN style objects.
 */
export const ABOUT_CSS = `
.ab-blur {
  -webkit-backdrop-filter: blur(18px) saturate(150%);
  backdrop-filter: blur(18px) saturate(150%);
}

.ab-tap {
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
  .ab-tap:hover {
    filter: brightness(1.14);
  }
}

.ab-tap:focus-visible {
  outline: 2px solid rgba(255, 255, 255, 0.72);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .ab-tap {
    transition: none !important;
  }
}
`;

const STYLE_ID = 'firesight-about-css';

/** Injects ABOUT_CSS once into the document head (no-op on native). */
export function useAboutStyles() {
  useEffect(() => {
    if (!isWeb || typeof document === 'undefined') return;
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = ABOUT_CSS;
    document.head.appendChild(style);
  }, []);
}