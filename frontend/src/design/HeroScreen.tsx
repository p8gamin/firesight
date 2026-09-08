import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  Image,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useDesignStyles } from './designCss';
import Entrance from './Entrance';
import AnimatedNavFramer from './AnimatedNavFramer';
import Spotlight from './Spotlight';
import { BG_IMAGE_1, BG_IMAGE_2, BP_MD, BP_SM, COLOR, COPY, FONT } from './constants';
import { isWeb } from './platform';

/** Full-bleed base image with the slow Ken Burns zoom-out. */
const BaseImage = memo(function BaseImage() {
  return (
    <Entrance kind="zoom" style={styles.layerBase}>
      <Image source={{ uri: BG_IMAGE_1 }} style={StyleSheet.absoluteFill} resizeMode="cover" />
    </Entrance>
  );
});

/**
 * FireSight headline — both lines set in Inter medium so the message reads
 * as one voice ("Before it Spreads" and "See Fire." share a font), with the
 * single word "Fire" carrying the ember accent. Type + palette follow the
 * Emil design-eng guidance: one neutral sans, near-monochrome with one
 * restrained accent. With the corner copy gone the block sits lower so the
 * frame feels full.
 */
const HeadingArea = memo(function HeadingArea() {
  const { width, height } = useWindowDimensions();
  const size = width >= BP_MD ? 96 : width >= BP_SM ? 72 : 44;
  const lineHeight = Math.round(size * 0.98);
  const typo1 = { fontSize: size, lineHeight, letterSpacing: -0.04 * size };
  const typo2 = { fontSize: size, lineHeight, letterSpacing: -0.06 * size };
  const androidTight = Platform.select({ android: { includeFontPadding: false } });

  return (
    <View
      style={[styles.headingWrap, { top: Math.round(height * 0.18) }]}
      pointerEvents="none"
    >
      <Entrance kind="reveal" delay={250} style={styles.headingLine}>
        <Text
          style={[
            styles.headingText,
            typo1,
            { fontFamily: FONT.interMedium },
            androidTight,
          ]}
        >
          {'See '}
          <Text style={{ color: COLOR.accent }}>{'Fire.'}</Text>
        </Text>
      </Entrance>
      <Entrance kind="reveal" delay={420} style={[styles.headingLine, { marginTop: -2 }]}>
        <Text
          style={[
            styles.headingText,
            typo2,
            { fontFamily: FONT.interMedium },
            androidTight,
          ]}
        >
          {COPY.headingLine2}
        </Text>
      </Entrance>
    </View>
  );
});

/**
 * The FireSight hero — full-screen, dark, with a cursor spotlight that
 * reveals a second image through a soft circular mask. Mouse position is
 * smoothed with an exponential lerp driven by requestAnimationFrame.
 */
export default function HeroScreen() {
  useDesignStyles();
  const { width: winW, height: winH } = useWindowDimensions();
  const [cursor, setCursor] = useState({ x: -999, y: -999 });

  const mouse = useRef({ x: -999, y: -999 });
  const smooth = useRef({ x: -999, y: -999 });
  const applied = useRef({ x: -999, y: -999 });
  const rafId = useRef<number | null>(null);

  const tick = useCallback(() => {
    const m = mouse.current;
    const s = smooth.current;
    // Exponential easing — 0.1 per frame, matching the template's lerp.
    s.x += (m.x - s.x) * 0.1;
    s.y += (m.y - s.y) * 0.1;

    if (
      Math.abs(s.x - applied.current.x) >= 0.05 ||
      Math.abs(s.y - applied.current.y) >= 0.05
    ) {
      applied.current = { x: s.x, y: s.y };
      setCursor({ x: s.x, y: s.y });
    }

    // Keep chasing until the smoothed point reaches the raw mouse.
    if (Math.hypot(m.x - s.x, m.y - s.y) > 0.1) {
      rafId.current = requestAnimationFrame(tick);
    } else {
      rafId.current = null;
    }
  }, []);

  const ensureLoop = useCallback(() => {
    if (rafId.current == null) {
      rafId.current = requestAnimationFrame(tick);
    }
  }, [tick]);

  const handleMove = useCallback(
    (clientX: number, clientY: number) => {
      mouse.current.x = clientX;
      mouse.current.y = clientY;
      ensureLoop();
    },
    [ensureLoop]
  );

  // Web: react-native-web doesn't forward onMouseMove, so listen on window
  // (same as the template's document-level mousemove listener).
  useEffect(() => {
    if (!isWeb || typeof window === 'undefined') return;
    const onMove = (e: MouseEvent) => handleMove(e.clientX, e.clientY);
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, [handleMove]);

  useEffect(() => {
    return () => {
      if (rafId.current != null) {
        cancelAnimationFrame(rafId.current);
        rafId.current = null;
      }
    };
  }, []);

  // Warm the image cache on device so the masked SVG image decodes fast.
  useEffect(() => {
    if (isWeb) return;
    Image.prefetch(BG_IMAGE_1).catch(() => undefined);
    Image.prefetch(BG_IMAGE_2).catch(() => undefined);
  }, []);

  // The hero page scrolls the document (hero → gallery → outro). Only while
  // it is mounted, opt html/body/#root back out of expo's fixed full-height
  // reset so the document can grow — the map and alerts screens never add
  // this class, so their #root keeps the reset's full height.
  useEffect(() => {
    if (!isWeb || typeof document === 'undefined') return;
    document.documentElement.classList.add('fs-hero-scroll');
    document.body.classList.add('fs-hero-scroll');
    return () => {
      document.documentElement.classList.remove('fs-hero-scroll');
      document.body.classList.remove('fs-hero-scroll');
    };
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) =>
        handleMove(evt.nativeEvent.pageX, evt.nativeEvent.pageY),
      onPanResponderMove: (evt) =>
        handleMove(evt.nativeEvent.pageX, evt.nativeEvent.pageY),
    })
  ).current;

  return (
    <View
      style={[styles.root, { width: winW, height: winH }]}
      {...(isWeb ? {} : panResponder.panHandlers)}
    >
      <View style={styles.stage}>
        <BaseImage />
        <Spotlight width={winW} height={winH} x={cursor.x} y={cursor.y} />
        <HeadingArea />
      </View>
      <AnimatedNavFramer />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: '#000',
  },
  stage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  layerBase: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
  },
  headingWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 50,
    flexDirection: 'column',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  headingLine: {
    alignItems: 'center',
  },
  headingText: {
    color: COLOR.white,
    textAlign: 'center',
  },
});