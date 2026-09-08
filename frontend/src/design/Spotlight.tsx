import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, {
  Defs,
  Image as SvgImage,
  Mask,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import { BG_IMAGE_2, SPOTLIGHT_RADIUS } from './constants';

interface SpotlightProps {
  /** Viewport size in px — the SVG user space is 1:1 with screen px. */
  width: number;
  height: number;
  /** Smoothly-lerped cursor position (client/page px). */
  x: number;
  y: number;
}

/**
 * Soft-edged radial gradient stops — mirrors the template's canvas gradient:
 * opaque at 0 → 0.4, then falling off to fully transparent at the edge.
 */
const STOPS: ReadonlyArray<{ offset: number; opacity: number }> = [
  { offset: 0, opacity: 1 },
  { offset: 0.4, opacity: 1 },
  { offset: 0.6, opacity: 0.75 },
  { offset: 0.75, opacity: 0.4 },
  { offset: 0.88, opacity: 0.12 },
  { offset: 1, opacity: 0 },
];

/**
 * The reveal layer. Renders BG_IMAGE_2 full-bleed, but only inside a soft
 * circular spotlight that follows the cursor: the image is masked by a radial
 * gradient centered on (x, y), so the base image shows through everywhere
 * else. This is the SVG/cross-platform equivalent of the template's
 * canvas-gradient → maskImage technique (which React Native can't use).
 */
export default function Spotlight({ width, height, x, y }: SpotlightProps) {
  if (width <= 0 || height <= 0) {
    return null;
  }

  return (
    <View style={styles.layer} pointerEvents="none">
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient
            id="spotGrad"
            gradientUnits="userSpaceOnUse"
            cx={x}
            cy={y}
            r={SPOTLIGHT_RADIUS}
          >
            {STOPS.map((stop) => (
              <Stop
                key={stop.offset}
                offset={stop.offset}
                stopColor="#ffffff"
                stopOpacity={stop.opacity}
              />
            ))}
          </RadialGradient>
          <Mask
            id="spotMask"
            maskUnits="userSpaceOnUse"
            maskContentUnits="userSpaceOnUse"
            x={0}
            y={0}
            width={width}
            height={height}
          >
            <Rect x={0} y={0} width={width} height={height} fill="url(#spotGrad)" />
          </Mask>
        </Defs>
        <SvgImage
          x={0}
          y={0}
          width={width}
          height={height}
          href={BG_IMAGE_2}
          preserveAspectRatio="xMidYMid slice"
          mask="url(#spotMask)"
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 30,
  },
});