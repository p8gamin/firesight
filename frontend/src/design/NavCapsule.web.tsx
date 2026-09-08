import * as React from 'react';
import { createPortal } from 'react-dom';
import { NAV_ITEMS } from './constants';
import {
  navCapsuleLink,
  navCapsuleLinks,
  navCapsuleNav,
  navCapsuleWrapper,
} from './navCapsuleStyles';

export interface NavCapsuleProps {
  /** Label of the currently active section (e.g. 'Map'). */
  active?: string;
  /** Called with the clicked section label. */
  onNavigate?: (label: string) => void;
}

/**
 * The floating frosted nav capsule (web). This is the exact same pill the
 * hero page renders (AnimatedNavFramer.web) — same classes, same inline
 * styles, same fixed top-center position — so the map screen shows a navbar
 * that is identical in size and placement. Like the hero nav it is portaled
 * to document.body so it always floats above the screen content.
 */
export default function NavCapsule({ active, onNavigate }: NavCapsuleProps) {
  if (typeof document === 'undefined') return null;

  const nav = (
    <div style={navCapsuleWrapper}>
      <nav className="cd-animated-nav" style={navCapsuleNav}>
        <div className="cd-animated-nav-links" style={navCapsuleLinks}>
          {NAV_ITEMS.map((item) => {
            const isActive = item.label === active;
            return (
              <a
                key={item.label}
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  onNavigate?.(item.label);
                }}
                className={
                  isActive
                    ? 'cd-animated-nav-link cd-animated-nav-link-active'
                    : 'cd-animated-nav-link'
                }
                style={{
                  ...navCapsuleLink,
                  ...(isActive ? { color: '#ffffff' } : null),
                }}
              >
                {item.label}
              </a>
            );
          })}
        </div>
      </nav>
    </div>
  );

  return createPortal(nav, document.body);
}