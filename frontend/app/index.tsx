import React from 'react';
import { ScrollView } from 'react-native';
import HeroScreen from '../src/design/HeroScreen';
import ScrollGallery from '../src/design/ScrollGallery';
import { isWeb } from '../src/design/platform';

/**
 * FireSight landing — the full-screen hero (fire-watch headline over a
 * spotlight photo), followed by the full-screen gallery section
 * (scroll-jack on web, paging swipe on native).
 * Wildfire functionality is intentionally not part of this screen.
 *
 * Web renders both as siblings and lets the document scroll (the web gallery
 * is a scroll-jack driven by window scroll). Native has no document scroll,
 * so the two are stacked inside a vertical ScrollView there.
 */
export default function Index() {
  const content = (
    <>
      <HeroScreen />
      <ScrollGallery />
    </>
  );
  if (isWeb) {
    return content;
  }
  return (
    <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
      {content}
    </ScrollView>
  );
}