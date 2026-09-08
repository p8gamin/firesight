import type { CSSProperties } from 'react';
import { Platform, StyleSheet } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

export const isWeb = Platform.OS === 'web';

/**
 * Returns a `className` prop (web only) so CSS classes / keyframes defined in
 * designCss can drive effects the RN style system can't express (backdrop
 * blur, keyframe animations, :hover/:active states). Returns {} on native.
 */
export const webClass = (className: string) =>
  isWeb ? ({ className } as Record<string, unknown>) : {};

/** RN style props whose numeric values stay unitless in CSS. */
const UNITLESS = new Set([
  'flex',
  'flexGrow',
  'flexShrink',
  'fontWeight',
  'opacity',
  'zIndex',
]);

/**
 * Converts an RN style (or style array) to a plain CSSProperties object for
 * the raw DOM wrappers we use on web (react-native-web drops `className`, so
 * elements that need CSS keyframes/hover/backdrop-filter are rendered as real
 * <div>s on web only). Layout defaults mirror RN: flex column.
 */
export function toWebStyle(style: StyleProp<ViewStyle>): CSSProperties | undefined {
  if (!isWeb) return undefined;
  const flat = StyleSheet.flatten(style) as Record<string, unknown> | null;
  if (!flat) return undefined;

  const css: Record<string, string | number> = {
    display: 'flex',
    flexDirection: 'column',
  };
  for (const key of Object.keys(flat)) {
    const value = flat[key];
    if (value == null || typeof value === 'boolean') continue;
    if (typeof value === 'object') continue; // transform arrays etc. — not needed here
    const cssKey = key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
    css[cssKey] = typeof value === 'number' && !UNITLESS.has(key) ? `${value}px` : (value as string | number);
  }
  // RN draws borders without a style; CSS needs an explicit one.
  if (
    css['border-style'] === undefined &&
    ('border-width' in css || 'border-color' in css)
  ) {
    css['border-style'] = 'solid';
  }
  return css as CSSProperties;
}

/** Convenience: clickable, focusable web-only pill item. */
export const webPillProps = (className: string) =>
  isWeb
    ? ({
        className,
        role: 'button',
        tabIndex: 0,
      } as Record<string, unknown>)
    : {};
