import React from 'react';
import LocationsScreen from '../src/locations/LocationsScreen';
import { RequireAuth } from '../src/lib/AuthGate';

/**
 * /locations — FireSight's saved places + personalized activity monitoring.
 * Saved locations are account-dependent: signed-in users get the full
 * screen, everyone else sees a sign-in prompt. The public experience
 * (hero, map, live fire data) stays open.
 */
export default function LocationsRoute() {
  return (
    <RequireAuth>
      <LocationsScreen />
    </RequireAuth>
  );
}
