import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { mapPalette } from '../map/tokens';
import { webClass, isWeb } from '../design/platform';
import { COLOR, FONT, BP_MD } from '../design/constants';
import { searchPlaces, type Place } from '../map/gazetteer';
import { addLocation, updateLocation } from './store';
import { NAME_SUGGESTIONS, RADIUS_OPTIONS } from './model';
import MiniMap from './MiniMap';
import { geocodeQuery } from '../services/geocoding';
import type { GeoPoint, Location, LocationAlertPrefs, LocationMonitors } from '../types';

const STEPS = ['Find location', 'Select location', 'Name location', 'Monitoring', 'Radius', 'Alerts', 'Review'];

const DEFAULT_MONITORS: LocationMonitors = { fires: true, heat: true, air: true };
const DEFAULT_PREFS: LocationAlertPrefs = {
  highConcern: true,
  moderate: true,
  newDetections: true,
  heatAnomalies: false,
  airQuality: false,
};

/** Build a selectable place record from a raw coordinate (current location /
 *  existing saved point). */
function placeFromPoint(point: GeoPoint, label: string): Place {
  const [name, ...rest] = label.split(',');
  return {
    id: `pt-${point.lat.toFixed(4)}-${point.lon.toFixed(4)}`,
    name: name.trim() || 'Selected point',
    kind: 'city',
    area: rest.join(',').trim(),
    lon: point.lon,
    lat: point.lat,
  };
}

/**
 * The Add / Edit Location flow — a seven-step modal.
 *
 * 1 Find location (search the gazetteer, or use the device location with an
 *   explicit permission prompt) → 2 confirm on a map preview → 3 name it →
 * 4 choose what to monitor → 5 monitoring radius → 6 alert preferences →
 * 7 review + save. Alert preferences are stored (not a claim that push
 * notifications are active); the backend wires delivery later.
 */
export default function AddLocationModal({
  visible,
  editing,
  onClose,
}: {
  visible: boolean;
  editing?: Location | null;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isMd = width >= BP_MD;

  const [step, setStep] = useState(0);
  const [place, setPlace] = useState<Place | null>(null);
  const [query, setQuery] = useState('');
  const [name, setName] = useState('');
  const [monitors, setMonitors] = useState<LocationMonitors>(DEFAULT_MONITORS);
  const [radiusKm, setRadiusKm] = useState<number>(25);
  const [prefs, setPrefs] = useState<LocationAlertPrefs>(DEFAULT_PREFS);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Reset the flow each time it opens; prefill when editing.
  const openedFor = editing?.id ?? null;
  const [lastOpenKey, setLastOpenKey] = useState<string | null>(null);
  if (visible && lastOpenKey !== openedFor) {
    setLastOpenKey(openedFor);
    setStep(0);
    setQuery('');
    setLocateError(null);
    setSaved(false);
    if (editing) {
      setPlace(placeFromPoint(editing.point, editing.placeLabel));
      setName(editing.name);
      setMonitors({ ...editing.monitors });
      setRadiusKm(editing.radiusKm);
      setPrefs({ ...editing.alertPrefs });
    } else {
      setPlace(null);
      setName('');
      setMonitors({ ...DEFAULT_MONITORS });
      setRadiusKm(25);
      setPrefs({ ...DEFAULT_PREFS });
    }
  }

  const results = useMemo(() => searchPlaces(query, 6), [query]);

  const selectPlace = useCallback((p: Place) => {
    setPlace(p);
    setQuery('');
    setStep(1);
  }, []);

  const locateMe = useCallback(async () => {
    setLocating(true);
    setLocateError(null);
    const fail = () => setLocateError('Location unavailable. Allow location access to add your current position.');
    try {
      if (isWeb) {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          if (typeof navigator === 'undefined' || !navigator.geolocation) {
            reject(new Error('unsupported'));
            return;
          }
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: false,
            timeout: 12000,
            maximumAge: 60000,
          });
        });
        setPlace(
          placeFromPoint(
            { lat: pos.coords.latitude, lon: pos.coords.longitude },
            'Current location'
          )
        );
        setStep(1);
        return;
      }
      const Location = require('expo-location') as typeof import('expo-location');
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        fail();
        return;
      }
      const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setPlace(placeFromPoint({ lat: p.coords.latitude, lon: p.coords.longitude }, 'Current location'));
      setStep(1);
    } catch {
      fail();
    } finally {
      setLocating(false);
    }
  }, []);

  const canContinue = useMemo(() => {
    if (step === 0) return place !== null;
    if (step === 2) return name.trim().length > 0;
    return true;
  }, [step, place, name]);

  const next = useCallback(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), []);
  const back = useCallback(() => setStep((s) => Math.max(s - 1, 0)), []);

  const save = useCallback(() => {
    if (!place) return;
    const draft = {
      name: name.trim() || 'My Place',
      kind: editing?.kind ?? ('custom' as Location['kind']),
      point: { lat: place.lat, lon: place.lon },
      placeLabel: place.area ? `${place.name}, ${place.area}` : place.name,
      radiusKm,
      alertsEnabled: prefs.highConcern || prefs.moderate || prefs.newDetections,
      monitors,
      alertPrefs: prefs,
    };
    if (editing) updateLocation(editing.id, draft);
    else addLocation(draft);
    setSaved(true);
    setTimeout(onClose, 450);
  }, [place, name, editing, radiusKm, prefs, monitors, onClose]);

  const label = editing ? 'Edit location' : 'Add Location';
  const panelWidth = isMd ? 520 : width - 20;
  const previewSize = isMd ? 460 : panelWidth - 48;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View
        style={[styles.backdropWrap, isMd && styles.backdropWrapMd]}
        pointerEvents="box-none"
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        <KeyboardAvoidingView
          behavior={isWeb ? undefined : Platform.OS === 'ios' ? 'padding' : undefined}
          style={[styles.anchor, isMd && styles.anchorMd]}
          pointerEvents="box-none"
        >
          <View
            style={[
              styles.panel,
              { width: panelWidth, maxHeight: '88%', paddingBottom: insets.bottom + 14 },
            ]}
            {...webClass('lc-blur')}
          >
            {/* header */}
            <View style={styles.header}>
              <View style={styles.headerText}>
                <Text style={styles.eyebrow}>
                  {label.toUpperCase()} · STEP {step + 1} OF {STEPS.length}
                </Text>
                <Text style={styles.title}>{STEPS[step]}</Text>
              </View>
              <Pressable
                onPress={onClose}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Close add location"
                style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.6 }]}
                {...webClass('lc-tap')}
              >
                <Ionicons name="close" size={18} color={mapPalette.textMuted} />
              </Pressable>
            </View>

            {/* progress */}
            <View style={styles.progressTrack}>
              {STEPS.map((s, i) => (
                <View
                  key={s}
                  style={[styles.progressSeg, i <= step && styles.progressSegOn]}
                />
              ))}
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.body}
            >
              {step === 0 ? (
                <FindStep
                  query={query}
                  setQuery={setQuery}
                  results={results}
                  locating={locating}
                  locateError={locateError}
                  onPick={selectPlace}
                  onLocate={locateMe}
                />
              ) : step === 1 ? (
                <SelectStep
                  place={place}
                  radiusKm={radiusKm}
                  previewSize={previewSize}
                />
              ) : step === 2 ? (
                <NameStep name={name} setName={setName} />
              ) : step === 3 ? (
                <MonitorStep monitors={monitors} setMonitors={setMonitors} />
              ) : step === 4 ? (
                <RadiusStep radiusKm={radiusKm} setRadiusKm={setRadiusKm} />
              ) : step === 5 ? (
                <AlertsStep prefs={prefs} setPrefs={setPrefs} />
              ) : (
                <ReviewStep
                  name={name}
                  place={place}
                  radiusKm={radiusKm}
                  monitors={monitors}
                  prefs={prefs}
                />
              )}
            </ScrollView>

            {/* footer nav */}
            <View style={styles.footer}>
              {step > 0 ? (
                <Pressable
                  onPress={back}
                  accessibilityRole="button"
                  accessibilityLabel="Back"
                  style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
                  {...webClass('lc-tap')}
                >
                  <Ionicons name="chevron-back" size={16} color={mapPalette.textMuted} />
                  <Text style={styles.backText}>Back</Text>
                </Pressable>
              ) : (
                <View style={{ width: 60 }} />
              )}

              {step < STEPS.length - 1 ? (
                <Pressable
                  onPress={next}
                  disabled={!canContinue}
                  accessibilityRole="button"
                  accessibilityLabel="Continue"
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    !canContinue && styles.primaryBtnDisabled,
                    pressed && canContinue && { opacity: 0.85, transform: [{ scale: 0.99 }] },
                  ]}
                  {...webClass('lc-tap')}
                >
                  <Text style={styles.primaryText}>Continue</Text>
                  <Ionicons name="arrow-forward" size={15} color="#fff" />
                </Pressable>
              ) : (
                <Pressable
                  onPress={save}
                  accessibilityRole="button"
                  accessibilityLabel={editing ? 'Save changes' : 'Save location'}
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    saved && styles.primaryBtnSaved,
                    pressed && !saved && { opacity: 0.85, transform: [{ scale: 0.99 }] },
                  ]}
                  {...webClass('lc-tap')}
                >
                  <Ionicons
                    name={saved ? 'checkmark' : 'bookmark-outline'}
                    size={15}
                    color="#fff"
                  />
                  <Text style={styles.primaryText}>
                    {saved ? 'Saved' : editing ? 'Save changes' : 'Save Location'}
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

function FindStep({
  query,
  setQuery,
  results,
  locating,
  locateError,
  onPick,
  onLocate,
}: {
  query: string;
  setQuery: (q: string) => void;
  results: Place[];
  locating: boolean;
  locateError: string | null;
  onPick: (p: Place) => void;
  onLocate: () => void;
}) {
  // OpenStreetMap (Nominatim) geocoding — turns free-text addresses into
  // real coordinates. Free and keyless; falls back silently to the offline
  // gazetteer when the network fails.
  const [geoResults, setGeoResults] = useState<Place[]>([]);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoFailed, setGeoFailed] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) {
      setGeoResults([]);
      setGeoLoading(false);
      return;
    }
    let cancelled = false;
    setGeoLoading(true);
    setGeoFailed(false);
    const t = setTimeout(() => {
      geocodeQuery(q)
        .then((r) => {
          if (cancelled) return;
          setGeoResults(r);
          setGeoLoading(false);
        })
        .catch(() => {
          if (cancelled) return;
          setGeoResults([]);
          setGeoLoading(false);
          setGeoFailed(true);
        });
    }, 600);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  // Manual coordinate entry (no Google needed).
  const [coordsOpen, setCoordsOpen] = useState(false);
  const [latText, setLatText] = useState('');
  const [lonText, setLonText] = useState('');
  const lat = Number(latText.trim());
  const lon = Number(lonText.trim());
  const coordsValid =
    Number.isFinite(lat) && Number.isFinite(lon) &&
    lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;

  return (
    <View style={styles.step}>
      <Text style={styles.question}>Where should FireSight monitor?</Text>
      <Text style={styles.hint}>Search a city, town, region, address or landmark.</Text>

      <View style={styles.searchUnit} {...webClass('lc-blur')}>
        <Ionicons name="search" size={16} color={mapPalette.textFaint} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search city, address, region..."
          placeholderTextColor={mapPalette.textFaint}
          style={styles.searchInput}
          autoCorrect={false}
          returnKeyType="search"
          onSubmitEditing={() => {
            if (geoResults[0]) onPick(geoResults[0]);
            else if (results[0]) onPick(results[0]);
          }}
          accessibilityLabel="Search a location"
        />
        {geoLoading ? <ActivityIndicator size="small" color={mapPalette.textFaint} /> : null}
        {query.length > 0 ? (
          <Pressable
            onPress={() => setQuery('')}
            hitSlop={10}
            accessibilityLabel="Clear search"
            style={({ pressed }) => [pressed && { opacity: 0.6 }]}
          >
            <Ionicons name="close-circle" size={17} color={mapPalette.textFaint} />
          </Pressable>
        ) : null}
      </View>

      {results.length > 0 ? (
        <View style={styles.results}>
          {results.map((r, i) => (
            <PlaceRow key={r.id} place={r} i={i} onPick={onPick} />
          ))}
        </View>
      ) : null}

      {geoResults.length > 0 ? (
        <View>
          <Text style={styles.geoEyebrow}>OPENSTREETMAP</Text>
          <View style={styles.results}>
            {geoResults.map((r, i) => (
              <PlaceRow key={r.id} place={r} i={i} onPick={onPick} />
            ))}
          </View>
        </View>
      ) : null}
      {geoFailed && query.trim().length >= 3 ? (
        <Text style={styles.geoHint}>Address search unavailable — showing saved places only.</Text>
      ) : null}

      <View style={styles.orRow}>
        <View style={styles.orLine} />
        <Text style={styles.orText}>OR</Text>
        <View style={styles.orLine} />
      </View>

      <Pressable
        onPress={onLocate}
        disabled={locating}
        accessibilityRole="button"
        accessibilityLabel="Use my current location"
        style={({ pressed }) => [
          styles.locateBtn,
          pressed && !locating && { opacity: 0.8 },
        ]}
        {...webClass('lc-tap')}
      >
        <Ionicons
          name={locating ? 'hourglass-outline' : 'locate-outline'}
          size={16}
          color={COLOR.accent}
        />
        <Text style={styles.locateText}>
          {locating ? 'Locating…' : 'Use My Current Location'}
        </Text>
      </Pressable>
      {locateError ? <Text style={styles.errorText}>{locateError}</Text> : null}

      {!coordsOpen ? (
        <Pressable
          onPress={() => setCoordsOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Enter coordinates manually"
          style={({ pressed }) => [styles.manualBtn, pressed && { opacity: 0.7 }]}
          {...webClass('lc-tap')}
        >
          <Ionicons name="grid-outline" size={14} color={mapPalette.textMuted} />
          <Text style={styles.manualText}>Enter coordinates manually</Text>
        </Pressable>
      ) : (
        <View style={styles.coordsRow}>
          <TextInput
            value={latText}
            onChangeText={setLatText}
            placeholder="Latitude"
            placeholderTextColor={mapPalette.textFaint}
            style={styles.coordInput}
            keyboardType="numbers-and-punctuation"
            autoCorrect={false}
            accessibilityLabel="Latitude"
          />
          <TextInput
            value={lonText}
            onChangeText={setLonText}
            placeholder="Longitude"
            placeholderTextColor={mapPalette.textFaint}
            style={styles.coordInput}
            keyboardType="numbers-and-punctuation"
            autoCorrect={false}
            accessibilityLabel="Longitude"
          />
          <Pressable
            onPress={() => coordsValid && onPick(placeFromPoint({ lat, lon }, 'Custom coordinates'))}
            disabled={!coordsValid}
            accessibilityRole="button"
            accessibilityLabel="Use these coordinates"
            style={({ pressed }) => [
              styles.coordApply,
              !coordsValid && { opacity: 0.4 },
              pressed && coordsValid && { opacity: 0.8 },
            ]}
            {...webClass('lc-tap')}
          >
            <Text style={styles.coordApplyText}>Add</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function PlaceRow({ place, i, onPick }: { place: Place; i: number; onPick: (p: Place) => void }) {
  return (
    <Pressable
      onPress={() => onPick(place)}
      accessibilityRole="button"
      accessibilityLabel={`Select ${place.name}`}
      style={({ pressed }) => [
        styles.resultRow,
        i > 0 && styles.resultRowBorder,
        pressed && { opacity: 0.7 },
      ]}
      {...webClass('lc-tap')}
    >
      <View style={styles.resultIcon}>
        <Ionicons
          name={place.kind === 'city' ? 'location' : place.kind === 'country' ? 'earth' : 'map'}
          size={14}
          color={place.kind === 'country' ? mapPalette.textMuted : COLOR.accent}
        />
      </View>
      <View style={styles.resultText}>
        <Text style={styles.resultName}>{place.name}</Text>
        {place.area ? <Text style={styles.resultArea}>{place.area}</Text> : null}
      </View>
      <Ionicons name="arrow-forward" size={13} color={mapPalette.textFaint} />
    </Pressable>
  );
}

function SelectStep({
  place,
  radiusKm,
  previewSize,
}: {
  place: Place | null;
  radiusKm: number;
  previewSize: number;
}) {
  if (!place) return null;
  return (
    <View style={styles.step}>
      <Text style={styles.question}>Confirm this location</Text>
      <MiniMap
        locationPoint={{ lat: place.lat, lon: place.lon }}
        placeLabel={place.area ? `${place.name}, ${place.area}` : place.name}
        radiusKm={radiusKm}
        width={previewSize}
        height={Math.round(previewSize * 0.62)}
      />
      <View style={styles.confirmCard}>
        <Text style={styles.confirmName}>{place.name}</Text>
        {place.area ? <Text style={styles.confirmArea}>{place.area}</Text> : null}
        <Text style={styles.confirmCoords}>
          {Math.abs(place.lat).toFixed(3)}° {place.lat >= 0 ? 'N' : 'S'} ·{' '}
          {Math.abs(place.lon).toFixed(3)}° {place.lon >= 0 ? 'E' : 'W'}
        </Text>
      </View>
    </View>
  );
}

function NameStep({ name, setName }: { name: string; setName: (n: string) => void }) {
  return (
    <View style={styles.step}>
      <Text style={styles.question}>What should we call this location?</Text>
      <Text style={styles.hint}>Pick a suggestion or type your own name.</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Home, School, Cottage…"
        placeholderTextColor={mapPalette.textFaint}
        style={styles.nameInput}
        maxLength={40}
        autoFocus={!isWeb}
        accessibilityLabel="Location name"
      />
      <View style={styles.suggestWrap}>
        {NAME_SUGGESTIONS.map((s) => {
          const active = name === s;
          return (
            <Pressable
              key={s}
              onPress={() => setName(s)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={({ pressed }) => [
                styles.suggestChip,
                active && styles.suggestChipOn,
                pressed && { opacity: 0.75 },
              ]}
              {...webClass('lc-tap')}
            >
              <Text style={[styles.suggestText, active && { color: '#fff' }]}>{s}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const MONITOR_ROWS: { key: keyof LocationMonitors; icon: 'flame' | 'thermometer-outline' | 'leaf-outline'; label: string; sub: string }[] = [
  { key: 'fires', icon: 'flame', label: 'Wildfires', sub: 'Satellite-detected thermal activity' },
  { key: 'heat', icon: 'thermometer-outline', label: 'Heat anomalies', sub: 'Early, lower-confidence detections' },
  { key: 'air', icon: 'leaf-outline', label: 'Air quality', sub: 'PM2.5 and AQI changes nearby' },
];

function MonitorStep({
  monitors,
  setMonitors,
}: {
  monitors: LocationMonitors;
  setMonitors: (m: LocationMonitors) => void;
}) {
  return (
    <View style={styles.step}>
      <Text style={styles.question}>Monitor for</Text>
      <Text style={styles.hint}>Choose what FireSight watches around this location.</Text>
      <View style={styles.toggleList}>
        {MONITOR_ROWS.map((r) => (
          <ToggleRow
            key={r.key}
            icon={r.icon}
            label={r.label}
            sub={r.sub}
            value={monitors[r.key]}
            onChange={(v) => setMonitors({ ...monitors, [r.key]: v })}
          />
        ))}
      </View>
    </View>
  );
}

function RadiusStep({
  radiusKm,
  setRadiusKm,
}: {
  radiusKm: number;
  setRadiusKm: (n: number) => void;
}) {
  return (
    <View style={styles.step}>
      <Text style={styles.question}>Monitoring radius</Text>
      <Text style={styles.radiusReadout}>{radiusKm} km</Text>
      <View style={styles.radiusTrack}>
        <View style={styles.radiusLine} />
        {RADIUS_OPTIONS.map((r) => {
          const active = radiusKm === r;
          const pct = (RADIUS_OPTIONS.indexOf(r) / (RADIUS_OPTIONS.length - 1)) * 100;
          return (
            <Pressable
              key={r}
              onPress={() => setRadiusKm(r)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${r} kilometre radius`}
              style={[styles.radiusDotWrap, { left: `${pct}%` }]}
              {...webClass('lc-tap')}
            >
              <View style={[styles.radiusDot, active && styles.radiusDotOn]} />
              <Text style={[styles.radiusDotLabel, active && { color: COLOR.accent }]}>{r}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.hint}>
        Activity within this distance will be considered relevant to this location.
      </Text>
    </View>
  );
}

const PREF_ROWS: { key: keyof LocationAlertPrefs; icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { key: 'highConcern', icon: 'warning-outline', label: 'High concern activity' },
  { key: 'moderate', icon: 'pulse-outline', label: 'Moderate concern activity' },
  { key: 'newDetections', icon: 'flame-outline', label: 'New wildfire detections' },
  { key: 'heatAnomalies', icon: 'thermometer-outline', label: 'Heat anomalies' },
  { key: 'airQuality', icon: 'leaf-outline', label: 'Air-quality changes' },
];

function AlertsStep({
  prefs,
  setPrefs,
}: {
  prefs: LocationAlertPrefs;
  setPrefs: (p: LocationAlertPrefs) => void;
}) {
  return (
    <View style={styles.step}>
      <Text style={styles.question}>Notify me about</Text>
      <Text style={styles.hint}>Per-location preferences for this place.</Text>
      <View style={styles.toggleList}>
        {PREF_ROWS.map((r) => (
          <ToggleRow
            key={r.key}
            icon={r.icon}
            label={r.label}
            value={prefs[r.key]}
            onChange={(v) => setPrefs({ ...prefs, [r.key]: v })}
          />
        ))}
      </View>
      <View style={styles.note}>
        <Ionicons name="information-circle-outline" size={14} color={mapPalette.textFaint} />
        <Text style={styles.noteText}>
          Preferences are saved with this location and activate when push notifications
          are enabled.
        </Text>
      </View>
    </View>
  );
}

function ReviewStep({
  name,
  place,
  radiusKm,
  monitors,
  prefs,
}: {
  name: string;
  place: Place | null;
  radiusKm: number;
  monitors: LocationMonitors;
  prefs: LocationAlertPrefs;
}) {
  const watching = [
    monitors.fires ? 'Wildfires' : null,
    monitors.heat ? 'Heat anomalies' : null,
    monitors.air ? 'Air quality' : null,
  ].filter(Boolean) as string[];

  const alerts = Object.entries(prefs)
    .filter(([, v]) => v)
    .map(([k]) => PREF_ROWS.find((r) => r.key === k)?.label ?? '')
    .filter(Boolean);

  return (
    <View style={styles.step}>
      <Text style={styles.question}>Review</Text>
      <View style={styles.reviewCard}>
        <Text style={styles.reviewName}>{name || 'My Place'}</Text>
        {place ? <Text style={styles.reviewPlace}>{place.area ? `${place.name}, ${place.area}` : place.name}</Text> : null}

        <View style={styles.reviewDivider} />
        <ReviewRow label="Monitoring radius" value={`${radiusKm} km`} />
        <ReviewRow label="Watching" value={watching.join(' · ')} />
        <ReviewRow label="Alerts" value={alerts.join(' · ') || 'None'} />
      </View>
    </View>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.reviewRow}>
      <Text style={styles.reviewLabel}>{label.toUpperCase()}</Text>
      <Text style={styles.reviewValue}>{value}</Text>
    </View>
  );
}

function ToggleRow({
  icon,
  label,
  sub,
  value,
  onChange,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sub?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <Pressable
      onPress={() => onChange(!value)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
      style={({ pressed }) => [styles.toggleRow, pressed && { opacity: 0.8 }]}
      {...webClass('lc-tap')}
    >
      <View style={[styles.toggleIcon, value && styles.toggleIconOn]}>
        <Ionicons name={icon} size={15} color={value ? '#fff' : mapPalette.textMuted} />
      </View>
      <View style={styles.toggleText}>
        <Text style={styles.toggleLabel}>{label}</Text>
        {sub ? <Text style={styles.toggleSub}>{sub}</Text> : null}
      </View>
      <View style={[styles.check, value && styles.checkOn]}>
        {value ? <Ionicons name="checkmark" size={13} color="#fff" /> : null}
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  backdropWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.62)', justifyContent: 'flex-end', alignItems: 'center' },
  backdropWrapMd: { justifyContent: 'center' },
  anchor: { width: '100%', alignItems: 'center', justifyContent: 'flex-end' },
  anchorMd: { justifyContent: 'center' },
  panel: {
    backgroundColor: 'rgba(13,18,24,0.97)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.11)',
    borderBottomWidth: 0,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: -10 },
    elevation: 20,
  },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16 },
  headerText: { flex: 1 },
  eyebrow: {
    fontFamily: FONT.interSemiBold,
    fontSize: 9.5,
    letterSpacing: 1.6,
    color: mapPalette.textFaint,
  },
  title: {
    fontFamily: FONT.interSemiBold,
    fontSize: 21,
    lineHeight: 26,
    letterSpacing: -0.5,
    color: COLOR.white,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  progressTrack: { flexDirection: 'row', gap: 4, paddingHorizontal: 20, marginTop: 12 },
  progressSeg: { flex: 1, height: 2.5, borderRadius: 1.5, backgroundColor: 'rgba(255,255,255,0.1)' },
  progressSegOn: { backgroundColor: COLOR.accent },

  body: { padding: 20, gap: 14 },
  step: { gap: 10 },
  question: { fontFamily: FONT.interSemiBold, fontSize: 16, lineHeight: 21, letterSpacing: -0.2, color: COLOR.white },
  hint: { fontFamily: FONT.interRegular, fontSize: 13, lineHeight: 19, color: mapPalette.textMuted },

  searchUnit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 13,
    paddingRight: 10,
    height: 46,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  searchInput: { flex: 1, fontFamily: FONT.interRegular, fontSize: 14.5, color: COLOR.white, paddingVertical: 0 },

  results: { borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.025)' },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10 },
  resultRowBorder: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  resultIcon: { width: 24, alignItems: 'center' },
  resultText: { flex: 1 },
  resultName: { fontFamily: FONT.interMedium, fontSize: 14, color: COLOR.white },
  resultArea: { fontFamily: FONT.interRegular, fontSize: 12, color: mapPalette.textFaint, marginTop: 1 },

  orRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 2 },
  orLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.08)' },
  orText: { fontFamily: FONT.interMedium, fontSize: 10, letterSpacing: 1.4, color: mapPalette.textFaint },

  locateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: 'rgba(237,140,73,0.45)',
    backgroundColor: 'rgba(237,140,73,0.08)',
    paddingVertical: 12,
  },
  locateText: { fontFamily: FONT.interSemiBold, fontSize: 14, color: COLOR.accent },
  errorText: { fontFamily: FONT.interRegular, fontSize: 12.5, lineHeight: 18, color: '#E57B7B', textAlign: 'center' },

  geoEyebrow: {
    fontFamily: FONT.interSemiBold,
    fontSize: 9,
    letterSpacing: 1.4,
    color: mapPalette.textFaint,
    marginBottom: 6,
  },
  geoHint: { fontFamily: FONT.interRegular, fontSize: 12, color: mapPalette.textFaint },

  manualBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  manualText: { fontFamily: FONT.interMedium, fontSize: 12.5, color: mapPalette.textMuted },
  coordsRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  coordInput: {
    flex: 1,
    fontFamily: FONT.interRegular,
    fontSize: 14,
    color: COLOR.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  coordApply: {
    borderRadius: 12,
    backgroundColor: COLOR.accent,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  coordApplyText: { fontFamily: FONT.interSemiBold, fontSize: 13.5, color: '#fff' },

  confirmCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    padding: 14,
  },
  confirmName: { fontFamily: FONT.interSemiBold, fontSize: 16, color: COLOR.white },
  confirmArea: { fontFamily: FONT.interRegular, fontSize: 13, color: mapPalette.textMuted, marginTop: 1 },
  confirmCoords: {
    fontFamily: FONT.interRegular,
    fontSize: 11.5,
    color: mapPalette.textFaint,
    marginTop: 6,
  },

  nameInput: {
    fontFamily: FONT.interRegular,
    fontSize: 16,
    color: COLOR.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 4,
  },
  suggestWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  suggestChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 13,
    paddingVertical: 7,
  },
  suggestChipOn: { backgroundColor: 'rgba(237,140,73,0.22)', borderColor: 'rgba(237,140,73,0.55)' },
  suggestText: { fontFamily: FONT.interMedium, fontSize: 13, color: mapPalette.textMuted },

  toggleList: { gap: 8, marginTop: 4 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.025)',
    paddingHorizontal: 13,
    paddingVertical: 11,
  },
  toggleIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  toggleIconOn: { backgroundColor: 'rgba(237,140,73,0.2)' },
  toggleText: { flex: 1 },
  toggleLabel: { fontFamily: FONT.interMedium, fontSize: 14, color: COLOR.white },
  toggleSub: { fontFamily: FONT.interRegular, fontSize: 11.5, color: mapPalette.textFaint, marginTop: 1 },
  check: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: COLOR.accent, borderColor: COLOR.accent },

  radiusReadout: {
    fontFamily: FONT.interSemiBold,
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: -1,
    color: COLOR.accent,
    marginTop: 6,
  },
  radiusTrack: { height: 58, marginTop: 10, marginHorizontal: 6 },
  radiusLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 7,
    height: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  radiusDotWrap: {
    position: 'absolute',
    top: 0,
    width: 40,
    marginLeft: -20,
    alignItems: 'center',
  },
  radiusDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    backgroundColor: '#0D1218',
  },
  radiusDotOn: {
    borderColor: COLOR.accent,
    backgroundColor: COLOR.accent,
  },
  radiusDotLabel: { fontFamily: FONT.interMedium, fontSize: 11, color: mapPalette.textFaint, marginTop: 7 },

  note: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginTop: 2 },
  noteText: {
    flex: 1,
    fontFamily: FONT.interRegular,
    fontSize: 12,
    lineHeight: 17,
    color: mapPalette.textFaint,
  },

  reviewCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    padding: 16,
    marginTop: 4,
  },
  reviewName: { fontFamily: FONT.interSemiBold, fontSize: 20, letterSpacing: -0.4, color: COLOR.white },
  reviewPlace: { fontFamily: FONT.interRegular, fontSize: 13.5, color: mapPalette.textMuted, marginTop: 2 },
  reviewDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 14 },
  reviewRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginBottom: 11 },
  reviewLabel: { fontFamily: FONT.interMedium, fontSize: 9.5, letterSpacing: 1.1, color: mapPalette.textFaint, paddingTop: 3 },
  reviewValue: { flex: 1, fontFamily: FONT.interMedium, fontSize: 13.5, color: COLOR.white, textAlign: 'right' },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 6,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingVertical: 12, paddingRight: 8 },
  backText: { fontFamily: FONT.interMedium, fontSize: 14, color: mapPalette.textMuted },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLOR.accent,
    borderRadius: 13,
    paddingHorizontal: 22,
    paddingVertical: 12,
  },
  primaryBtnDisabled: { opacity: 0.4 },
  primaryBtnSaved: { backgroundColor: '#3E8A63' },
  primaryText: { fontFamily: FONT.interSemiBold, fontSize: 14.5, color: '#fff', letterSpacing: 0.2 },
});