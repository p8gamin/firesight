/**
 * Google Maps dark styling for the FireSight map (Android / iOS-Google).
 * Mirrors the bespoke basemap palette in ./tokens: near-black water,
 * slightly lifted land, hairline geography, faint labels — a subdued command
 * surface that keeps the ember accent reserved for fire itself.
 *
 * Apple Maps (iOS default provider) has no custom-style API; it follows the
 * app's dark interface style instead (userInterfaceStyle on the MapView).
 */
import type { MapStyleElement } from 'react-native-maps';

export const GOOGLE_DARK_MAP_STYLE: MapStyleElement[] = [
  { elementType: 'geometry', stylers: [{ color: '#10161D' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: 'rgba(255,255,255,0.55)' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#05080C' }] },
  {
    featureType: 'administrative',
    elementType: 'geometry.stroke',
    stylers: [{ color: 'rgba(255,255,255,0.16)' }],
  },
  {
    featureType: 'administrative.country',
    elementType: 'geometry.stroke',
    stylers: [{ color: 'rgba(255,255,255,0.22)' }],
  },
  {
    featureType: 'administrative.land_parcel',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'landscape.man_made',
    elementType: 'geometry',
    stylers: [{ color: '#0E141A' }],
  },
  {
    featureType: 'landscape.natural',
    elementType: 'geometry',
    stylers: [{ color: '#10161D' }],
  },
  {
    featureType: 'poi',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: 'rgba(255,255,255,0.06)' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'road',
    elementType: 'labels',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: 'rgba(255,255,255,0.1)' }],
  },
  {
    featureType: 'transit',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#070B10' }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [{ color: 'rgba(255,255,255,0.3)' }],
  },
];
