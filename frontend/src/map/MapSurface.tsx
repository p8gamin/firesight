/**
 * MapSurface — type-level module for the platform-split map component.
 *
 * This file is what TypeScript resolves for `import MapSurface from
 * './MapSurface'`. At RUNTIME Metro never bundles it: the platform
 * implementations win extension resolution
 *
 *   native → ./MapSurface.native.tsx  (react-native-maps)
 *   web    → ./MapSurface.web.tsx     (SVG basemap + gesture camera)
 *
 * so this module only declares the shared component shape.
 */
import type { ForwardRefExoticComponent, RefAttributes } from 'react';
import type { MapSurfaceHandle, MapSurfaceProps } from './mapSurfaceTypes';

export type { MapSurfaceHandle, MapSurfaceProps };

declare const MapSurface: ForwardRefExoticComponent<
  MapSurfaceProps & RefAttributes<MapSurfaceHandle>
>;
export default MapSurface;
