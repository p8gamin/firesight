import type { CSSProperties } from 'react';
import { FONT } from './constants';

/**
 * Shared web styles for the floating frosted nav capsule. Both the hero nav
 * (AnimatedNavFramer.web) and the map screen (NavCapsule.web) render the
 * exact same pill from these constants, so size and position can never drift
 * between the two screens.
 */
export const navCapsuleWrapper: CSSProperties = {
  position: 'fixed',
  top: 24,
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 50,
};

export const navCapsuleNav: CSSProperties = {
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'center',
  overflow: 'hidden',
  borderRadius: 999,
  height: 48,
};

export const navCapsuleLinks: CSSProperties = {
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'center',
  paddingLeft: 12,
  paddingRight: 12,
};

export const navCapsuleLink: CSSProperties = {
  fontSize: 14,
  fontWeight: 500,
  fontFamily: FONT.interMedium,
  padding: '4px 8px',
  whiteSpace: 'nowrap',
};