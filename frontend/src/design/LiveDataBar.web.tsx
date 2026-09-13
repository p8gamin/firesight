/**
 * LiveDataBar (web) — the global "retrieving live heat data" indicator.
 *
 * Raw DOM + createPortal, following the AnimatedNavFramer pattern: RN-Web
 * drops `className` on RN elements, and View wrappers set position:relative
 * + z-index:0 on ancestors, trapping fixed/absolute overlays in low stacking
 * contexts. Portaling a plain <div> to document.body sidesteps both — the
 * same reason the nav is portaled.
 *
 * Visual language mirrors the Map banner (frosted dark pill, spinner, same
 * copy). Position is `fixed` bottom-center so it stays in view while the
 * hero page scrolls the document. The component injects its own tiny
 * stylesheet (fade/spin keyframes) — it must not depend on DESIGN_CSS,
 * which only screens that call useDesignStyles() ever mount.
 *
 * Signals: the fire store's `syncing` flag (any /fires request in flight)
 * plus the locations store's `loading` phase (the saved_locations fetch
 * that precedes it). Idle states (no saved locations / signed out) never
 * show the bar.
 */
import * as React from 'react';
import { createPortal } from 'react-dom';

import { useFiresState } from '../services/fireStore';
import { useLocationsStore } from '../locations/store';
import { FONT } from './constants';

const STYLE_ID = 'fs-livebar-css';
const LIVEBAR_CSS = `
@keyframes fs-livebar-spin { to { transform: rotate(360deg); } }
@keyframes fs-livebar-fade {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
`;

/** Injects the bar's keyframes once per document. */
function useLivebarStyles() {
  React.useEffect(() => {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = LIVEBAR_CSS;
    document.head.appendChild(style);
  }, []);
}

export default function LiveDataBar() {
  const { syncing } = useFiresState();
  const { phase } = useLocationsStore();
  useLivebarStyles();

  if (typeof document === 'undefined') return null;
  if (!syncing && phase !== 'loading') return null;

  return createPortal(
    <div
      className="fs-livebar-wrap"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 20,
        display: 'flex',
        justifyContent: 'center',
        zIndex: 90,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          backgroundColor: 'rgba(13, 17, 22, 0.82)',
          border: '1px solid rgba(255,255,255,0.14)',
          borderRadius: 999,
          padding: '8px 14px',
          boxShadow: '0 8px 16px -6px rgba(0,0,0,0.45)',
          WebkitBackdropFilter: 'blur(10px)',
          backdropFilter: 'blur(10px)',
          animation: 'fs-livebar-fade 200ms ease-out',
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 14,
            height: 14,
            borderRadius: '50%',
            border: '2px solid rgba(255,255,255,0.25)',
            borderTopColor: 'rgba(255,255,255,0.7)',
            animation: 'fs-livebar-spin 800ms linear infinite',
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontFamily: `"${FONT.interRegular}", "Inter", sans-serif`,
            fontSize: 13,
            lineHeight: '18px',
            color: 'rgba(255,255,255,0.85)',
          }}
        >
          Loading live heat data…
        </span>
      </div>
    </div>,
    document.body
  );
}
