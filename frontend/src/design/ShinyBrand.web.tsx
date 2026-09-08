import * as React from 'react';
import { useRouter } from 'expo-router';

/** FireSight logo mark (transparent PNG), resolved by Metro. */
const logoAsset: any = require('../../assets/logo.png');
const logoSrc = typeof logoAsset === 'string' ? logoAsset : logoAsset.uri;

/**
 * The top-left FireSight brand as a shiny pill button (web). The logo and
 * wordmark live inside the button; the rotating conic shine + dots pattern
 * come from the `.fs-shiny-brand` rules in designCss, themed to FireSight
 * (forest green base, ember-orange highlight). Clicking it returns to the
 * hero via dismissTo (never stacking a duplicate).
 */
export default function ShinyBrand() {
  const router = useRouter();

  return (
    <button
      type="button"
      className="fs-shiny-brand"
      onClick={() => router.dismissTo('/')}
      aria-label="FireSight — back to home"
    >
      <span>
        <img src={logoSrc} alt="FireSight logo" className="fs-shiny-brand-logo" />
        FireSight
      </span>
    </button>
  );
}