import React from 'react';
import AlertsScreen from '../src/alerts/AlertsScreen';
import { RequireAuth } from '../src/lib/AuthGate';

/**
 * /alerts — FireSight's attention centre. Personalized alerts are
 * account-dependent: signed-in users get the full screen, everyone else
 * sees a sign-in prompt. The public experience (hero, map, live fire
 * data) stays open.
 */
export default function AlertsRoute() {
  return (
    <RequireAuth>
      <AlertsScreen />
    </RequireAuth>
  );
}
