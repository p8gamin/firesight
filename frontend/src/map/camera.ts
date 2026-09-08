import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {
  O,
  lonLatToPlane,
  planeToLonLat,
  txFor,
  initialCamera,
  clampScale,
  clampTranslation,
  type ViewportSize,
} from './geo';

/** plane → screen (worklet-safe). */
export function planeToScreen(x: number, y: number, s: number, tx: number, ty: number) {
  'worklet';
  return {
    sx: x * s + O * (1 - s) + tx,
    sy: y * s + O * (1 - s) + ty,
  };
}

/** screen → plane (worklet-safe). */
export function screenToPlane(sx: number, sy: number, s: number, tx: number, ty: number) {
  'worklet';
  return {
    x: (sx - tx - O * (1 - s)) / s,
    y: (sy - ty - O * (1 - s)) / s,
  };
}

const FLY_EASE = Easing.bezier(0.16, 1, 0.3, 1);

/** The three shared values every billboard/style reads to track the camera. */
export interface CameraVals {
  s: ReturnType<typeof useSharedValue<number>>;
  tx: ReturnType<typeof useSharedValue<number>>;
  ty: ReturnType<typeof useSharedValue<number>>;
}

export interface MapCameraApi {
  /** Pan + pinch gesture — attach inside a <GestureDetector>. */
  gesture: ReturnType<typeof Gesture.Simultaneous>;
  /** Transform for the plane content (translate, then scale about centre). */
  cameraStyle: ReturnType<typeof useAnimatedStyle>;
  /** True while dragging (drives the grab cursor). */
  panning: boolean;
  /** Shared camera values (billboard positioning). */
  vals: CameraVals;
  /** JS-thread settle listener: (scale, tx, ty) after gestures/animations. */
  onSettle: (cb: (scale: number, tx: number, ty: number) => void) => void;
  /** Fired (JS) when the user begins a drag/pinch — closes the fire card. */
  setInteractionStart: (cb: () => void) => void;
  flyToGeo: (lon: number, lat: number, opts?: { scale?: number }) => void;
  zoomBy: (factor: number) => void;
  fitNorthAmerica: () => void;
  centerGeo: () => { lon: number; lat: number };
  currentScale: () => number;
}

export function useMapCamera(size: ViewportSize): MapCameraApi {
  const init = useMemo(() => initialCamera(size), [size.width, size.height]);
  const reducedMotion = useReducedMotion();

  const s = useSharedValue(init.s);
  const tx = useSharedValue(init.tx);
  const ty = useSharedValue(init.ty);
  const vw = useSharedValue(size.width);
  const vh = useSharedValue(size.height);

  const [panning, setPanning] = useState(false);

  // Worklet scratch values.
  const gStartTx = useSharedValue(0);
  const gStartTy = useSharedValue(0);
  const pinStartS = useSharedValue(1);
  const pinStartPx = useSharedValue(0);
  const pinStartPy = useSharedValue(0);

  // JS-thread listeners (kept in refs; invoked from stable callbacks).
  const settleCb = useRef<((scale: number, tx: number, ty: number) => void) | null>(null);
  const interactionCb = useRef<(() => void) | null>(null);
  const lastSize = useRef<ViewportSize>(size);

  useEffect(() => {
    const changed =
      lastSize.current.width !== size.width || lastSize.current.height !== size.height;
    lastSize.current = size;
    vw.value = size.width;
    vh.value = size.height;
    if (changed && size.width > 0 && size.height > 0) {
      // Reframe on rotate/resize (a view change, not a goal — instant).
      const c = initialCamera(size);
      cancelAnimation(s);
      s.value = c.s;
      tx.value = c.tx;
      ty.value = c.ty;
      settleCb.current?.(c.s, c.tx, c.ty);
    } else if (size.width > 0 && size.height > 0) {
      // Announce the initial framing so labels / zoom-gated overlays render at
      // the right scale immediately (values are already set by construction).
      settleCb.current?.(s.get(), tx.get(), ty.get());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.width, size.height]);

  const notifySettle = useCallback(() => {
    settleCb.current?.(s.get(), tx.get(), ty.get());
  }, [s, tx, ty]);

  const notifyInteractionStart = useCallback(() => {
    setPanning(true);
    interactionCb.current?.();
  }, []);

  const notifyEnd = useCallback(() => {
    setPanning(false);
    settleCb.current?.(s.get(), tx.get(), ty.get());
  }, [s, tx, ty]);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(5)
        .maxPointers(1)
        .onStart(() => {
          gStartTx.value = tx.value;
          gStartTy.value = ty.value;
          runOnJS(notifyInteractionStart)();
        })
        .onUpdate((e) => {
          const c = clampTranslation(
            gStartTx.value + e.translationX,
            gStartTy.value + e.translationY,
            s.value,
            { width: vw.value, height: vh.value }
          );
          tx.value = c.tx;
          ty.value = c.ty;
        })
        .onEnd(() => runOnJS(notifyEnd)()),
    [gStartTx, gStartTy, tx, ty, vw, vh, notifyInteractionStart, notifyEnd]
  );

  const pinch = useMemo(
    () =>
      Gesture.Pinch()
        .onStart((e) => {
          pinStartS.value = s.value;
          const p = screenToPlane(e.focalX, e.focalY, s.value, tx.value, ty.value);
          pinStartPx.value = p.x;
          pinStartPy.value = p.y;
          runOnJS(notifyInteractionStart)();
        })
        .onUpdate((e) => {
          const ns = clampScale(pinStartS.value * e.scale, {
            width: vw.value,
            height: vh.value,
          });
          // Keep the plane point that was under the fingers pinned there.
          const fx = e.focalX - pinStartPx.value * ns - O * (1 - ns);
          const fy = e.focalY - pinStartPy.value * ns - O * (1 - ns);
          const c = clampTranslation(fx, fy, ns, {
            width: vw.value,
            height: vh.value,
          });
          tx.value = c.tx;
          ty.value = c.ty;
          s.value = ns;
        })
        .onEnd(() => runOnJS(notifyEnd)()),
    [pinStartS, pinStartPx, pinStartPy, s, tx, ty, vw, vh, notifyInteractionStart, notifyEnd]
  );

  const composed = useMemo(() => Gesture.Simultaneous(pinch, pan), [pan, pinch]);

  const cameraStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: s.value },
    ],
  }));

  /** Animate so plane point (cx, cy) sits at viewport centre at scale. */
  const animateTo = useCallback(
    (cx: number, cy: number, scale: number, opts?: { instant?: boolean }) => {
      const v = { width: vw.value, height: vh.value };
      const ns = clampScale(scale, v);
      const t = txFor(cx, cy, ns, v);
      if (opts?.instant || reducedMotion || !v.width || !v.height) {
        cancelAnimation(s);
        s.value = ns;
        tx.value = t.tx;
        ty.value = t.ty;
        notifySettle();
        return;
      }
      const dur = 680;
      cancelAnimation(s);
      s.value = withTiming(ns, { duration: dur, easing: FLY_EASE }, () => {
        runOnJS(notifySettle)();
      });
      tx.value = withTiming(t.tx, { duration: dur, easing: FLY_EASE });
      ty.value = withTiming(t.ty, { duration: dur, easing: FLY_EASE });
    },
    [s, tx, ty, vw, vh, reducedMotion, notifySettle]
  );

  const flyToGeo = useCallback(
    (lon: number, lat: number, opts?: { scale?: number }) => {
      const p = lonLatToPlane(lon, lat);
      const scale =
        opts?.scale ??
        clampScale(
          s.get() * 1.4,
          { width: vw.value, height: vh.value }
        );
      animateTo(p.x, p.y, scale);
    },
    [animateTo, s, vw, vh]
  );

  const zoomBy = useCallback(
    (factor: number) => {
      // Keep the plane point currently under the viewport centre fixed.
      const v = { width: vw.value, height: vh.value };
      const p = screenToPlane(v.width / 2, v.height / 2, s.get(), tx.get(), ty.get());
      animateTo(p.x, p.y, s.get() * factor);
    },
    [animateTo, s, tx, ty, vw, vh]
  );

  const fitNorthAmerica = useCallback(() => {
    const c = initialCamera({ width: vw.value, height: vh.value });
    animateTo(c.x, c.y, c.s, { instant: true });
  }, [animateTo, vw, vh]);

  const centerGeo = useCallback(() => {
    const cur = s.get();
    const p = screenToPlane(vw.get() / 2, vh.get() / 2, cur, tx.get(), ty.get());
    return planeToLonLat(p.x, p.y);
  }, [s, tx, ty, vw, vh]);

  const currentScale = useCallback(() => s.get(), [s]);

  const onSettle = useCallback((cb: (scale: number, tx: number, ty: number) => void) => {
    settleCb.current = cb;
  }, []);

  const setInteractionStart = useCallback((cb: () => void) => {
    interactionCb.current = cb;
  }, []);

  return {
    gesture: composed,
    cameraStyle,
    panning,
    vals: { s, tx, ty },
    onSettle,
    setInteractionStart,
    flyToGeo,
    zoomBy,
    fitNorthAmerica,
    centerGeo,
    currentScale,
  };
}
