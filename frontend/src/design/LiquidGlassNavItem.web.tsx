import React from 'react';
import { FONT } from './constants';

export interface LiquidGlassNavItemProps {
  label: string;
  /** Whether this item is the currently selected section. */
  active?: boolean;
  onPress?: () => void;
}

/**
 * Liquid-glass nav pill (web).
 *
 * A frosted-glass capsule translated from the "Liquid Glass" button
 * reference: a translucent white gradient body with backdrop blur, and a
 * layered box-shadow stack that sculpts the glass — a bright bottom-right
 * inner bevel, a faint top-left catch light, a thin white veil across the
 * body, and a soft outer drop shadow + glow. Hover/selected states (CSS in
 * designCss.ts) brighten the glass and lift the pill; pressing pushes it in.
 * The native twin (LiquidGlassNavItem.tsx) approximates the same look with
 * gradients since backdrop blur isn't available without extra deps.
 */
export default function LiquidGlassNavItem({
  label,
  active = false,
  onPress,
}: LiquidGlassNavItemProps) {
  return (
    <button
      type="button"
      className={active ? 'cd-glass cd-glass-active' : 'cd-glass'}
      onClick={() => onPress?.()}
      aria-pressed={active}
    >
      <span className="cd-glass-label" style={{ fontFamily: FONT.interMedium }}>
        {label}
      </span>
    </button>
  );
}
