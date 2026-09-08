import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';

/**
 * AnimatedBackground — a web-only replica of the magicui `<AnimatedBackground>`
 * tab pill (https://magicui.design/docs/components/animated-tabs).
 *
 * Renders children (which must carry a string `data-id`) inside a relative
 * flex container and slides a highlight pill behind the active item. The
 * motion is a hand-rolled spring (stiffness/damping derived from the
 * framer-motion `{ type: 'spring', bounce, duration }` transition shape), so
 * no animation library is required. Web only — native keeps the static pill.
 */
export type SpringTransition = {
  type?: 'spring';
  /** Overshoot strength (0 = none). Mirrors framer-motion's `bounce`. */
  bounce?: number;
  /** Approximate settle time in seconds. Mirrors framer-motion's `duration`. */
  duration?: number;
};

type Rect = { x: number; y: number; w: number; h: number };

/** framer-motion's spring mapping: duration → stiffness, bounce → damping ratio. */
function springParams({ bounce = 0.25, duration = 0.3 }: SpringTransition = {}) {
  const stiffness = (Math.PI * 2) ** 2 / duration ** 2;
  const ratio = (1 - bounce) / (1 + bounce);
  const damping = 2 * ratio * Math.sqrt(stiffness);
  return { stiffness, damping };
}

function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function AnimatedBackground({
  children,
  defaultValue,
  activeItem,
  onValueChange,
  className,
  style,
  transition,
  enableHover = false,
  activeClassName,
}: {
  children: ReactNode;
  defaultValue?: string | null;
  activeItem?: string | null;
  onValueChange?: (activeId: string | null) => void;
  className?: string;
  style?: CSSProperties;
  transition?: SpringTransition;
  enableHover?: boolean;
  /** Class for the sliding highlight pill (sets its background). */
  activeClassName?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const itemEls = useRef(new Map<string, HTMLElement>());
  const [activeId, setActiveId] = useState<string | null>(defaultValue ?? null);
  const activeIdRef = useRef(activeId);
  activeIdRef.current = activeId;

  // Spring state: current rect + velocity per axis.
  const anim = useRef({ x: 0, y: 0, w: 0, h: 0, vx: 0, vy: 0, vw: 0, vh: 0 });
  const target = useRef({ x: 0, y: 0, w: 0, h: 0 });
  const initRef = useRef(false);
  const settledRef = useRef(true);
  const noSpringRef = useRef(prefersReducedMotion());
  const [rect, setRect] = useState<Rect | null>(null);

  const setActive = useCallback(
    (id: string | null) => {
      setActiveId(id);
      onValueChange?.(id);
    },
    [onValueChange]
  );

  useEffect(() => {
    if (defaultValue != null) setActiveId(defaultValue);
  }, [defaultValue]);

  useEffect(() => {
    if (activeItem != null) setActiveId(activeItem);
  }, [activeItem]);

  /** Measures the active item relative to the container and retargets the spring. */
  const measure = useCallback(() => {
    const id = activeIdRef.current;
    const el = id == null ? undefined : itemEls.current.get(id);
    const parent = containerRef.current;
    if (!el || !parent) return;
    const pr = parent.getBoundingClientRect();
    const er = el.getBoundingClientRect();
    const t = {
      x: er.left - pr.left,
      y: er.top - pr.top,
      w: er.width,
      h: er.height,
    };
    target.current = t;
    // Snap on first paint (no fly-in from 0,0) and whenever motion is reduced.
    if (noSpringRef.current || !initRef.current) {
      initRef.current = true;
      anim.current = { ...t, vx: 0, vy: 0, vw: 0, vh: 0 };
      setRect(t);
    }
  }, []);

  useEffect(() => {
    measure();
  }, [measure, activeId]);

  useEffect(() => {
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure]);

  // Continuous spring loop: cheap when settled (no state writes), retargets
  // automatically when `measure` updates target.current (hover / resize).
  useEffect(() => {
    if (noSpringRef.current || activeId == null) return;
    const { stiffness, damping } = springParams(transition);
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min((now - last) / 1000, 1 / 30);
      last = now;
      const a = anim.current;
      const t = target.current;
      // Semi-implicit Euler with substeps for stability at these stiffnesses.
      const h = dt / 4;
      for (let i = 0; i < 4; i++) {
        a.vx += (-stiffness * (a.x - t.x) - damping * a.vx) * h;
        a.x += a.vx * h;
        a.vy += (-stiffness * (a.y - t.y) - damping * a.vy) * h;
        a.y += a.vy * h;
        a.vw += (-stiffness * (a.w - t.w) - damping * a.vw) * h;
        a.w += a.vw * h;
        a.vh += (-stiffness * (a.h - t.h) - damping * a.vh) * h;
        a.h += a.vh * h;
      }
      const close =
        Math.abs(a.vx) < 0.05 &&
        Math.abs(a.vy) < 0.05 &&
        Math.abs(a.vw) < 0.05 &&
        Math.abs(a.vh) < 0.05 &&
        Math.abs(a.x - t.x) < 0.2 &&
        Math.abs(a.y - t.y) < 0.2 &&
        Math.abs(a.w - t.w) < 0.2 &&
        Math.abs(a.h - t.h) < 0.2;
      if (close) {
        if (!settledRef.current) {
          settledRef.current = true;
          anim.current = { ...t, vx: 0, vy: 0, vw: 0, vh: 0 };
          setRect(t);
        }
        return;
      }
      settledRef.current = false;
      setRect({ x: a.x, y: a.y, w: a.w, h: a.h });
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [activeId, transition?.bounce, transition?.duration]);

  /** Stable ref callback — reads the id off the element, so it never churns. */
  const registerItem = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    const id = el.getAttribute('data-ref-id');
    if (id) itemEls.current.set(id, el);
  }, []);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ position: 'relative', display: 'flex', alignItems: 'center', ...style }}
    >
      {rect && activeId != null && (
        <div
          className={activeClassName}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: rect.w,
            height: rect.h,
            transform: `translate(${rect.x}px, ${rect.y}px)`,
            borderRadius: 999,
            backgroundColor: activeClassName ? undefined : '#fff',
            zIndex: 0,
            pointerEvents: 'none',
            willChange: 'transform',
          }}
        />
      )}
      {React.Children.map(children, (child) => {
        if (!React.isValidElement(child)) return child;
        const id = (child.props as Record<string, unknown>)['data-id'];
        if (typeof id !== 'string') return child;
        return (
          <div
            key={id}
            ref={registerItem}
            data-ref-id={id}
            onMouseEnter={enableHover ? () => setActive(id) : undefined}
            onClick={() => setActive(id)}
            style={{ position: 'relative', zIndex: 1, display: 'flex' }}
          >
            {child}
          </div>
        );
      })}
    </div>
  );
}