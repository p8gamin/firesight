import React, { useCallback, useState } from 'react';
import { ActivityBottomSheet } from '../components/ActivityBottomSheet';
import type { ActivityGroup } from '../types';
import { useWeather, useAirQuality, useIncidents } from './useData';

export interface GeoPoint {
  lat: number;
  lon: number;
}

/**
 * Shared helper that wires the ActivityBottomSheet to the data layer, so any
 * screen can open an activity's detail panel with a single call.
 */
export function useActivitySheet() {
  const [group, setGroup] = useState<ActivityGroup | null>(null);
  const [origin, setOrigin] = useState<GeoPoint | null>(null);

  const { data: weather, loading: weatherLoading } = useWeather();
  const { data: air, loading: airLoading } = useAirQuality();
  const { data: incidents } = useIncidents();

  const open = useCallback((g: ActivityGroup, from: GeoPoint) => {
    setGroup(g);
    setOrigin(from);
  }, []);

  const close = useCallback(() => {
    setGroup(null);
    setOrigin(null);
  }, []);

  const incident = group?.incidentId
    ? incidents.find((i) => i.id === group.incidentId)
    : undefined;

  const render = () => {
    if (!group || !origin) return null;
    return (
      <ActivityBottomSheet
        group={group}
        origin={origin}
        weather={weatherLoading ? undefined : weather}
        air={airLoading ? undefined : air}
        incident={incident}
        visible={!!group}
        onClose={close}
      />
    );
  };

  return { open, close, render, activeGroup: group };
}