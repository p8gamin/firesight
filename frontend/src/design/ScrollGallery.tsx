import React, { useRef } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLOR, FONT, GALLERY_ITEMS, STREAM_EXTRA_IMAGES } from './constants';
import ImageStreamHero from './ImageStreamHero';

/**
 * FireSight image gallery (native). The web twin (ScrollGallery.web.tsx)
 * uses a scroll-jack filmstrip driven by window scroll; native has no
 * document scroll, so this renders the same five image cards as a freely
 * scrolling horizontal ScrollView. No snapping while swiping — tapping a
 * card animates the row to center that image. Cards without a `photo` render
 * a neutral dashed frame labelled "Image N", ready for a URL in
 * GALLERY_ITEMS.
 */
export default function ScrollGallery() {
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const cardW = Math.min(Math.round(width * 0.8), 640);
  const gap = 12;
  const imageH = Math.round(cardW * 0.9);

  const snapTo = (index: number) => {
    scrollRef.current?.scrollTo({ x: index * (cardW + gap), animated: true });
  };

  return (
    <View style={styles.section}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.row, { paddingRight: Math.max(24, width - cardW - 24) }]}
      >
        {GALLERY_ITEMS.map((item, i) => (
          <Pressable
            key={item.id}
            onPress={() => snapTo(i)}
            accessibilityRole="button"
            accessibilityLabel={`Show ${item.label}`}
            style={({ pressed }) => [styles.card, { width: cardW }, pressed && styles.cardPressed]}
          >
            {item.image ? (
              <Image
                source={{ uri: item.image }}
                style={[styles.image, { height: imageH }]}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.image, styles.slot, { height: imageH }]}>
                <LinearGradient
                  colors={['#1a1f26', '#10141a']}
                  style={StyleSheet.absoluteFill}
                />
                <Text style={[styles.slotLabel, { color: item.color }]}>
                  IMAGE {item.id}
                </Text>
              </View>
            )}
            <Text style={[styles.number, { color: item.color }]}>{`0${item.id}`}</Text>
            <Text style={styles.label}>{item.label}</Text>
            <Text style={styles.caption}>{item.caption}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Outro: FireSight + byline above the ambient image stream. */}
      <ImageStreamHero images={STREAM_IMAGES}>
        <Text style={styles.wordmark}>FireSight</Text>
        <Text style={styles.byline}>A project by Krishnavivek Ivaturi.</Text>
      </ImageStreamHero>
    </View>
  );
}

/**
 * Corridor stream: the same imagery as the gallery cards, in order,
 * followed by the extra stream images from constants.
 */
const STREAM_IMAGES = [
  ...GALLERY_ITEMS.flatMap((item) =>
    item.image ? [{ src: item.image, alt: item.label }] : [],
  ),
  ...STREAM_EXTRA_IMAGES,
];

const styles = StyleSheet.create({
  section: {
    backgroundColor: '#000',
    paddingVertical: 40,
  },
  row: {
    paddingLeft: 24,
    gap: 12,
  },
  card: {
    flexShrink: 0,
  },
  cardPressed: {
    opacity: 0.85,
  },
  image: {
    width: '100%',
    borderRadius: 18,
    backgroundColor: '#14181d',
    overflow: 'hidden',
  },
  slot: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.28)',
  },
  slotLabel: {
    fontFamily: FONT.interSemiBold,
    fontSize: 11,
    letterSpacing: 3,
  },
  number: {
    marginTop: 14,
    fontSize: 11,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    fontFamily: FONT.interSemiBold,
  },
  label: {
    marginTop: 6,
    fontSize: 24,
    fontWeight: '600',
    color: COLOR.white,
    fontFamily: FONT.interSemiBold,
  },
  caption: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 22,
    color: COLOR.white60,
    fontFamily: FONT.interRegular,
  },
  wordmark: {
    fontSize: 40,
    lineHeight: 48,
    color: COLOR.white,
    fontFamily: FONT.interMedium,
    letterSpacing: -0.8,
  },
  byline: {
    marginTop: 12,
    paddingTop: 24,
    fontSize: 13,
    lineHeight: 20,
    color: 'rgba(255,255,255,0.45)',
    fontFamily: FONT.interRegular,
  },
});
