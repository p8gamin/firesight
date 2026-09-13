import React from 'react';
import AuthScreen from '../src/design/AuthScreen';

/**
 * /signin — Ignova sign in / sign up. Opened from the landing page's
 * "Get Started" CTA. One screen, two modes; the link under the heading
 * swaps between them.
 */
export default function SignInRoute() {
  return <AuthScreen />;
}
