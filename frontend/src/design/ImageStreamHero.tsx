import React, { useMemo } from 'react';
import { Animated, Easing, Image, StyleSheet, View } from 'react-native';

/**
 * Native twin of ImageStreamHero.web.
 *
 * The web build renders the 3D perspective corridor with CSS keyframes; RN
 * has no CSS perspective, so the native version carries the same intent — a
 * continuously drifting stream of the same imagery below the Ignova
 * outro — as two rails that slowly marquee in opposite directions.
 *
 * Performance notes (this section used to be a static wrapped grid on
 * Android, so the "image streaming" section appeared not to work at all):
 * - The motion is driven by two Animated.Value offsets (one per rail) mapped
 *   onto each rail's translateX. Both loops run on the native driver — zero
 *   JS work per frame, zero React re-renders while streaming.
 * - Cards repeat (two copies per rail) so the loop is seamless.
 * - The band is transparent to touches (pointerEvents="none") so it never
 *   interferes with the page's vertical scroll.
 */
export default function ImageStreamHero({
  images,
  children,
  height = 420,
  cardSize = 150,
}: {
  images: { src: string; alt?: string }[];
  children?: React.ReactNode;
  height?: number;
  /** Square card edge in px. */
  cardSize?: number;
}) {
  const gap = 10;

  // Rail contents: alternating images split across two rows, each padded to
  // at least a few cards so the loop has room to travel.
  const rails = useMemo(() => {
    const left: { src: string; alt?: string }[] = [];
    const right: { src: string; alt?: string }[] = [];
    images.forEach((img, i) => (i % 2 === 0 ? left : right).push(img));
    const minCards = 4;
    while (images.length > 0 && left.length < minCards) {
      left.push(images[left.length % images.length]);
    }
    while (images.length > 0 && right.length < minCards) {
      right.push(images[(right.length + 1) % images.length]);
    }
    return { left, right };
  }, [images]);

  const cycleL = rails.left.length * (cardSize + gap);
  const cycleR = rails.right.length * (cardSize + gap);

  const offsetL = useMemo(() => new Animated.Value(0), []);
  const offsetR = useMemo(() => new Animated.Value(0), []);

  // x for each rail as an Animated node (native-driven):
  // left rail drifts leftward, right rail drifts rightward.
  const xL = useMemo(
    () => offsetL.interpolate({ inputRange: [0, 1], outputRange: [0, -cycleL] }),
    [offsetL, cycleL]
  );
  const xR = useMemo(
    () => offsetR.interpolate({ inputRange: [0, 1], outputRange: [-cycleR, 0] }),
    [offsetR, cycleR]
  );

  React.useEffect(() => {
    const loopL = Animated.loop(
      Animated.timing(offsetL, {
        toValue: 1,
        duration: Math.max(24000, cycleL * 90), // gentle drift, ~90ms per px
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    const loopR = Animated.loop(
      Animated.timing(offsetR, {
        toValue: 1,
        duration: Math.max(24000, cycleR * 110),
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loopL.start();
    loopR.start();
    return () => {
      loopL.stop();
      loopR.stop();
    };
  }, [offsetL, offsetR, cycleL, cycleR]);

  const renderRail = (
    items: { src: string; alt?: string }[],
    x: Animated.AnimatedInterpolation<number>,
    keyPrefix: string
  ) => (
    <Animated.View style={[styles.rail, { transform: [{ translateX: x }] }]}>
      {/* Two copies of the cards make the loop seamless. */}
      {[0, 1].map((copy) =>
        items.map((img, i) => (
          <Image
            key={`${keyPrefix}-${copy}-${i}`}
            source={{ uri: img.src }}
            style={[
              styles.image,
              { width: cardSize, height: cardSize, borderRadius: 14 },
            ]}
            resizeMode="cover"
            accessibilityLabel={img.alt}
          />
        ))
      )}
    </Animated.View>
  );

  return (
    <View style={styles.section}>
      {children ? <View style={styles.header}>{children}</View> : null}
      <View style={[styles.band, { height: Math.max(height, cardSize * 2 + gap) }]}>
        <View style={styles.railsWrap} pointerEvents="none">
          {renderRail(rails.left, xL, 'l')}
          {renderRail(rails.right, xR, 'r')}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: '#000',
    paddingVertical: 56,
    gap: 32,
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  band: {
    overflow: 'hidden',
    justifyContent: 'center',
  },
  railsWrap: {
    gap: 10,
  },
  rail: {
    flexDirection: 'row',
    gap: 10,
  },
  image: {
    backgroundColor: '#14181d',
  },
});
