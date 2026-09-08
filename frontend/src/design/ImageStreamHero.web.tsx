import * as React from 'react';

/* ── the corridor ────────────────────────────────────────────────
 * Adapted from the ImageStreamHero (shadcn paste-in) component into the
 * FireSight web-twin pattern: same fitted geometry and keyframe math, raw
 * DOM + inline CSS (no Tailwind/cn) so it runs inside the Expo RN web app.
 *
 * Two rails of cards ride from far behind the screen toward the viewer.
 * Perspective alone does the work that looks like two animations: as a
 * card's z grows it gets bigger *and* its screen x sweeps outward from the
 * vanishing point, because the projection scales position and size by the
 * same factor.
 *
 * Three things shape it, and each one fixes a specific artefact:
 *
 * 1. Depth is authored as *apparent size*, geometrically — each card is a
 *    constant ratio bigger than the one behind it, all the way out.
 * 2. The rails open hard in the first stretch and then hold (`fan` > 1).
 * 3. Neither end of the loop is ever on screen: cards die past 50cqw and
 *    are born across the axis (negative railBirth), so the centre never
 *    opens up and a newborn lands behind cards that already cover it.
 *
 * Every length is in `cqw` — a percentage of the container's width — so the
 * whole corridor keeps its proportions at any size.
 * ─────────────────────────────────────────────────────────────── */

/** Geometry of the corridor. Every length is `cqw`, a % of container width. */
export type CorridorPath = {
  perspective?: number;
  cardWidth?: number;
  cardHeight?: number;
  cardRadius?: number;
  birthHeight?: number;
  exitHeight?: number;
  railBirth?: number;
  railExit?: number;
  fan?: number;
  turnBirth?: number;
  turnExit?: number;
  stops?: number;
};

const PATH: Required<CorridorPath> = {
  perspective: 30,
  cardWidth: 18,
  cardHeight: 25,
  cardRadius: 0.4,
  birthHeight: 2.6,
  exitHeight: 46,
  railBirth: -11,
  railExit: 44,
  fan: 3.3,
  turnBirth: 6,
  turnExit: 28,
  stops: 24,
};

/** Sample the path once so the CSS keyframes trace the real curve. */
function keyframes(dir: 1 | -1, name: string, p: Required<CorridorPath>) {
  const steps: string[] = [];
  for (let s = 0; s <= p.stops; s++) {
    const u = s / p.stops;
    // Geometric in apparent size, so consecutive cards keep a constant size
    // ratio and the ribbon stays solid at both ends.
    const scale =
      (p.birthHeight / p.cardHeight) * Math.pow(p.exitHeight / p.birthHeight, u);
    const z = p.perspective * (1 - 1 / scale);
    const rail = p.railExit - (p.railExit - p.railBirth) * Math.pow(1 - u, p.fan);
    const turn = p.turnBirth + (p.turnExit - p.turnBirth) * u;
    steps.push(
      `${(u * 100).toFixed(2)}%{transform:translate3d(${(dir * rail).toFixed(
        2,
      )}cqw,0,${z.toFixed(2)}cqw) rotateY(${(-dir * turn).toFixed(2)}deg)}`,
    );
  }
  return `@keyframes ${name}{${steps.join('')}}`;
}

export type StreamImage = {
  src: string;
  alt?: string;
};

export type ImageStreamHeroProps = {
  images: StreamImage[];
  cards?: number;
  /** Seconds for one card to travel the whole corridor. */
  speed?: number;
  /** Vertical placement of the corridor's axis, as a percentage of height. */
  axis?: number;
  path?: CorridorPath;
  /** Content rendered above the corridor (e.g. the FireSight outro text). */
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
};

export function ImageStreamHero({
  images,
  cards = 9,
  speed = 18,
  axis = 55,
  path,
  children,
  className,
  ...props
}: ImageStreamHeroProps) {
  const id = React.useId().replace(/[^a-zA-Z0-9]/g, '');
  const right = `ish-r-${id}`;
  const left = `ish-l-${id}`;
  const card = `ish-c-${id}`;

  const p = React.useMemo(() => ({ ...PATH, ...path }), [path]);

  const css = React.useMemo(
    () =>
      `${keyframes(1, right, p)}${keyframes(-1, left, p)}` +
      // Pausing rather than disabling keeps the corridor whole: every card is
      // already dropped mid-flight by its negative delay, so it freezes as a
      // finished still instead of collapsing onto the axis.
      `@media(prefers-reduced-motion:reduce){.${card}{animation-play-state:paused}}`,
    [right, left, card, p],
  );

  return (
    <div
      className={className}
      style={{
        position: 'relative',
        overflow: 'hidden',
        containerType: 'inline-size',
        ...props.style,
      }}
    >
      <style>{css}</style>
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          perspective: `${p.perspective}cqw`,
          perspectiveOrigin: `50% ${axis}%`,
        }}
      >
        <div style={{ position: 'absolute', inset: 0, transformStyle: 'preserve-3d' }}>
          {[right, left].map((name) =>
            Array.from({ length: cards }, (_, i) => {
              // Both rails walk the same sequence, so the left side mirrors
              // the right at every depth.
              const img = images[i % Math.max(images.length, 1)];
              return (
                <div
                  key={`${name}-${i}`}
                  className={card}
                  style={{
                    position: 'absolute',
                    overflow: 'hidden',
                    left: '50%',
                    top: `${axis}%`,
                    width: `${p.cardWidth}cqw`,
                    height: `${p.cardHeight}cqw`,
                    marginLeft: `${-p.cardWidth / 2}cqw`,
                    marginTop: `${-p.cardHeight / 2}cqw`,
                    borderRadius: `${p.cardRadius}cqw`,
                    animation: `${name} ${speed}s linear infinite`,
                    // Negative delay drops each card mid-flight, so the
                    // corridor is already full on the first frame.
                    animationDelay: `${-(i * speed) / cards}s`,
                    backfaceVisibility: 'hidden',
                  }}
                >
                  {img ? (
                    <img
                      src={img.src}
                      alt={img.alt ?? ''}
                      loading="lazy"
                      decoding="async"
                      style={{
                        height: '100%',
                        width: '100%',
                        objectFit: 'cover',
                        userSelect: 'none',
                        pointerEvents: 'none',
                      }}
                      draggable={false}
                    />
                  ) : null}
                </div>
              );
            }),
          )}
        </div>
      </div>
      {children}
    </div>
  );
}

export default ImageStreamHero;
