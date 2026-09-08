/**
 * Device location.
 *
 * - Web: browser Geolocation API.
 * - Native: expo-location (already a project dependency).
 *
 * `resolveDeviceCoords` asks for permission when needed (used by the map's
 * locate button — the only place the app resolves the device position, so
 * first open plots nothing). `resolveDeviceCoordsIfPermitted` NEVER prompts —
 * it only resolves when the user has already granted access. The backend
 * request itself is centred on the user's primary SAVED location (see
 * services/fireStore): with no saved locations nothing is requested and
 * nothing is plotted.
 */
import { isWeb } from '../design/platform';

export type LocationSource = 'device';

export interface RequestCoords {
  lat: number;
  lon: number;
  source: LocationSource;
}

const POSITION_TIMEOUT_MS = 12_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

async function webCoords(): Promise<RequestCoords> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    throw new Error('Geolocation unavailable');
  }
  const position = await withTimeout(
    new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: false,
        timeout: POSITION_TIMEOUT_MS,
        maximumAge: 5 * 60_000,
      });
    }),
    POSITION_TIMEOUT_MS + 2_000,
    'Location request'
  );
  return { lat: position.coords.latitude, lon: position.coords.longitude, source: 'device' };
}

async function nativeCoords(): Promise<RequestCoords> {
  // Required lazily, matching the existing pattern in MapScreen.locateMe.
  const Location = require('expo-location') as typeof import('expo-location');
  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== 'granted') {
    throw new Error('Location permission denied');
  }
  const position = await withTimeout(
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
    POSITION_TIMEOUT_MS + 3_000,
    'Location request'
  );
  return { lat: position.coords.latitude, lon: position.coords.longitude, source: 'device' };
}

/**
 * Resolve the device location, THROWING when permission is denied or the
 * position is unavailable. The Map screen's locate button uses this so it
 * can tell the user why nothing happened.
 */
export async function resolveDeviceCoords(): Promise<RequestCoords> {
  return isWeb ? webCoords() : nativeCoords();
}

/**
 * Resolve the device location only when permission has ALREADY been granted
 * — never prompts. Returns null when permission is missing/undecided so the
 * caller can stay quiet (the locate button handles the actual ask).
 */
export async function resolveDeviceCoordsIfPermitted(): Promise<RequestCoords | null> {
  try {
    if (isWeb) {
      const permissions = navigator.permissions;
      if (!permissions?.query) return null;
      const status = await permissions.query({ name: 'geolocation' as PermissionName });
      if (status.state !== 'granted') return null;
      return await webCoords();
    }
    const Location = require('expo-location') as typeof import('expo-location');
    const existing = await Location.getForegroundPermissionsAsync();
    if (!existing.granted) return null;
    return await nativeCoords();
  } catch {
    return null;
  }
}
