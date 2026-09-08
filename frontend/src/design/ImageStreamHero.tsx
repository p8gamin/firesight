import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

/**
 * Native twin of ImageStreamHero.web. RN has no CSS perspective, cqw units
 * or @keyframes, so the 3D corridor can't be reproduced here — instead the
 * images drift slowly as a quiet ambient band, carrying the same intent
 * (a stream of imagery below the FireSight outro text) without faking depth.
 * The web build imports the raw-DOM corridor from ImageStreamHero.web.tsx.
 */
export default function ImageStreamHero({
  images,
  children,
  height = 420,
}: {
  images: { src: string; alt?: string }[];
  children?: React.ReactNode;
  height?: number;
}) {
  return (
    <View style={styles.section}>
      {children ? <View style={styles.header}>{children}</View> : null}
      <View style={[styles.band, { height }]}>
        <View style={styles.rail}>
          {images.map((img, i) => (
            <Image
              key={`${img.src}-${i}`}
              source={{ uri: img.src }}
              style={styles.image}
              resizeMode="cover"
              accessibilityLabel={img.alt}
            />
          ))}
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
  },
  rail: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 24,
  },
  image: {
    width: 150,
    height: 150,
    borderRadius: 14,
    backgroundColor: '#14181d',
  },
});
