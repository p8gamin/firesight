import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Text } from 'react-native';
import { MapScene, kmToPlaneY } from '../map/MapScene';
import { WORLD_PX, lonLatToPlane, txFor } from '../map/geo';
import { planeToScreen } from '../map/camera';
import { COLOR, FONT } from '../design/constants';
import type { GeoPoint } from '../types';

export interface MiniMarker {
  id: string;
  point: GeoPoint;
  kind: 'fire' | 'heat';
  /** 0..100 — drives marker size/intensity for fires. */
  concern?: number;
}

/**
 * Compact, non-interactive map for the Locations experience. Reuses the real
 * FireSight basemap (MapScene) with a static camera centred on the saved
 * location: the monitoring radius draws as a dashed ring, the saved location
 * as the teal centre dot, and activity markers are placed by their true
 * bearing/distance. Used by the add/edit flow's preview and the location
 * detail's \"Activity around …\" map.
 */
export default function MiniMap({
  locationPoint,
  placeLabel,
  radiusKm,
  markers = [],
  airLabel,
  width,
  height,
}: {
  locationPoint: GeoPoint;
  placeLabel: string;
  radiusKm: number;
  markers?: MiniMarker[];
  airLabel?: string | null;
  width: number;
  height: number;
}) {
  const camera = useMemo(() => {
    const { x, y } = lonLatToPlane(locationPoint.lon, locationPoint.lat);
    // Frame ~2.5× the monitoring radius across the short axis.
    const spanKm = Math.max(radiusKm * 2.5, 24);
    const s = Math.min(width, height) / kmToPlaneY(spanKm);
    const t = txFor(x, y, s, { width, height });
    return { s, tx: t.tx, ty: t.ty };
  }, [locationPoint, radiusKm, width, height]);

  const radiusPx = kmToPlaneY(radiusKm) * camera.s;

  const placed = useMemo(
    () =>
      markers
        .map((m) => {
          const { x, y } = lonLatToPlane(m.point.lon, m.point.lat);
          const p = planeToScreen(x, y, camera.s, camera.tx, camera.ty);
          return { ...m, sx: p.sx, sy: p.sy };
        })
        .filter((m) => m.sx > -30 && m.sx < width + 30 && m.sy > -30 && m.sy < height + 30),
    [markers, camera, width, height]
  );

  return (
    <View style={[styles.frame, { width, height }]}>
      <View
        style={[
          styles.plane,
          {
            transform: [
              { translateX: camera.tx },
              { translateY: camera.ty },
              { scale: camera.s },
            ],
          },
        ]}
        pointerEvents="none"
      >
        <MapScene
          heatRegions={[]}
          perimeters={[]}
          heatOn={false}
          settle={camera}
          viewport={{ width, height }}
          labels={false}
        />
      </View>

      {/* radius ring + centre dot + activity markers (screen space) */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg width={width} height={height}>
          <Circle
            cx={width / 2}
            cy={height / 2}
            r={radiusPx}
            stroke="rgba(255,255,255,0.28)"
            strokeWidth={1.25}
            strokeDasharray="5 6"
            fill="none"
          />
          {placed.map((m) => {
            if (m.kind === 'fire') {
              const d = Math.max(5, Math.min(11, 4 + ((m.concern ?? 0) / 100) * 7));
              return (
                <React.Fragment key={m.id}>
                  <Circle cx={m.sx} cy={m.sy} r={d + 5} fill="#ED8C49" opacity={0.14} />
                  <Circle cx={m.sx} cy={m.sy} r={d} fill="#ED8C49" opacity={0.85} />
                  <Circle cx={m.sx} cy={m.sy} r={d * 0.55} fill="#F7B98A" />
                </React.Fragment>
              );
            }
            return (
              <React.Fragment key={m.id}>
                <Circle cx={m.sx} cy={m.sy} r={8} fill="#E8A23C" opacity={0.16} />
                <Circle cx={m.sx} cy={m.sy} r={4} fill="#E8A23C" opacity={0.8} />
              </React.Fragment>
            );
          })}
          {/* saved location — teal centre dot with pulse ring */}
          <Circle cx={width / 2} cy={height / 2} r={11} fill="#3FB68B" opacity={0.18} />
          <Circle
            cx={width / 2}
            cy={height / 2}
            r={6.5}
            stroke="#3FB68B"
            strokeWidth={1.5}
            fill="rgba(63,182,139,0.12)"
          />
          <Circle cx={width / 2} cy={height / 2} r={2.4} fill="#7FD9B4" />
        </Svg>

        {/* place + air labels */}
        <View style={styles.labelTop} pointerEvents="none">
          <TextPill text={placeLabel} />
        </View>
        {airLabel ? (
          <View style={styles.labelBottom} pointerEvents="none">
            <TextPill text={`Air · ${airLabel}`} />
          </View>
        ) : null}
      </View>
    </View>
  );
}

function TextPill({ text }: { text: string }) {
  return (
    <View style={styles.pill}>
      <Text style={styles.pillText} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden', borderRadius: 18, backgroundColor: '#070B10' },
  plane: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: WORLD_PX,
    height: WORLD_PX,
  },
  labelTop: { position: 'absolute', top: 10, left: 10 },
  labelBottom: { position: 'absolute', bottom: 10, left: 10 },
  pill: {
    maxWidth: 220,
    backgroundColor: 'rgba(7,11,16,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  pillText: {
    fontFamily: FONT.interMedium,
    fontSize: 10.5,
    lineHeight: 13,
    color: COLOR.white,
  },
});