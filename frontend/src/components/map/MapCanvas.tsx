import React from 'react';
import { View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Line, Text as SvgText, G } from 'react-native-svg';
import type { Location, ActivityGroup, Incident } from '../../types';
import { palette, severityColor } from '../../theme';

interface LatLon {
  lat: number;
  lon: number;
}

function project(pts: LatLon[], width: number, height: number) {
  const lats = pts.map((p) => p.lat);
  const lons = pts.map((p) => p.lon);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const pad = 44;
  const latSpan = Math.max(maxLat - minLat, 0.05);
  const lonSpan = Math.max(maxLon - minLon, 0.05);
  const sx = (width - pad * 2) / lonSpan;
  const sy = (height - pad * 2) / latSpan;
  return (p: LatLon) => ({
    x: pad + (p.lon - minLon) * sx,
    y: height - pad - (p.lat - minLat) * sy,
  });
}

export function MapCanvas({
  locations,
  groups,
  incidents,
  selectedGroupId,
  onSelectGroup,
}: {
  locations: Location[];
  groups: ActivityGroup[];
  incidents: Incident[];
  selectedGroupId?: string | null;
  onSelectGroup?: (id: string) => void;
}) {
  const { width, height } = useWindowDimensions();
  const canvasH = height * 0.6;
  const all: LatLon[] = [
    ...locations.map((l) => l.point),
    ...groups.map((g) => g.point),
    ...incidents.map((i) => i.point),
  ];
  const pr = project(all.length ? all : [{ lat: 34, lon: -118 }], width, canvasH);

  return (
    <View style={{ width, height: canvasH }}>
      <Svg width={width} height={canvasH}>
        {Array.from({ length: 6 }).map((_, i) => {
          const x = (width / 7) * (i + 1);
          return <Line key={i} x1={x} y1={0} x2={x} y2={canvasH} stroke={palette.borderSubtle} strokeWidth={1} />;
        })}

        {/* monitoring radius */}
        {locations.map((l) => {
          const c = pr(l.point);
          return (
            <Circle
              key={l.id}
              cx={c.x}
              cy={c.y}
              r={radiusPx(l.radiusKm, width)}
              fill={palette.accent + '0a'}
              stroke={palette.accent + '33'}
              strokeWidth={1.5}
              strokeDasharray="4 6"
            />
          );
        })}

        {/* activity groups (tappable) */}
        {groups.map((g) => {
          const c = pr(g.point);
          const sev = severityColor[g.severity];
          const selected = g.id === selectedGroupId;
          return (
            <G key={g.id} onPress={() => onSelectGroup?.(g.id)}>
              <Circle cx={c.x} cy={c.y} r={selected ? 16 : 13} fill={sev + '55'} />
              <Circle cx={c.x} cy={c.y} r={selected ? 8 : 6} fill={sev} />
              {selected && <Circle cx={c.x} cy={c.y} r={21} fill="none" stroke={sev} strokeWidth={2} />}
            </G>
          );
        })}

        {/* official incidents (distinct diamond marker) */}
        {incidents.map((i) => {
          const c = pr(i.point);
          const d = 8;
          return (
            <G key={i.id}>
              <Circle cx={c.x} cy={c.y} r={d} fill={palette.low} opacity={0.9} />
              <SvgText x={c.x} y={c.y + 3} fill="#04121A" fontSize={11} fontWeight="700" textAnchor="middle">
                !
              </SvgText>
              <SvgText x={c.x} y={c.y - 16} fill={palette.low} fontSize={9} textAnchor="middle">
                {i.name}
              </SvgText>
            </G>
          );
        })}

        {/* saved locations */}
        {locations.map((l) => {
          const c = pr(l.point);
          return (
            <G key={`loc-${l.id}`}>
              <Circle cx={c.x} cy={c.y} r={7} fill="#fff" stroke={palette.accent} strokeWidth={2.5} />
              <SvgText x={c.x} y={c.y - 15} fill="#fff" fontSize={10} fontWeight="600" textAnchor="middle">
                {l.name}
              </SvgText>
            </G>
          );
        })}
      </Svg>
    </View>
  );
}

function radiusPx(km: number, width: number) {
  return (km / 40) * (width / 6);
}
