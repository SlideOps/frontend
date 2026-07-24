import { Globe, Lock, Server } from '@slideops/icons';
import { useEffect, useRef } from 'react';
import { Glow, Grain, Reveal, WordReveal, useReducedMotion } from '../motion';

const headline = 'Any Linux server, anywhere you run it';

/**
 * Warm the closing word of the globe headline into a peach ember as it lands,
 * matching the hero's word-warming language. The primitive stays copy-agnostic;
 * this holds the section's own emphasis, matched on the leading word so trailing
 * punctuation still resolves.
 */
function warmWord(word: string): string | undefined {
  if (word.startsWith('anywhere')) return 'so-hero-word-cognac';
  return undefined;
}

const assurances = [
  { icon: Server, label: 'Your servers, wherever they run' },
  { icon: Lock, label: 'Reached only over SSH' },
  { icon: Globe, label: 'Never owned by SlideOps' },
];

type Rgb = [number, number, number];

/** Cap the pixel ratio so the canvas stays cheap on dense displays. */
const MAX_DPR = 2;
/** Draw at a calm 30fps; the rotation is slow, so a smaller budget is invisible. */
const FRAME_INTERVAL = 1000 / 30;
/** How many dots make up the sphere. Enough to read as a globe, cheap to paint. */
const DOT_COUNT = 560;
/** Radians per second the globe turns. Slow and premium, never busy. */
const ROTATION_SPEED = 0.16;
/** A gentle fixed tilt so the globe is seen from slightly above its equator. */
const GLOBE_TILT = -0.36;

function hexToRgb(hex: string): Rgb {
  const value = hex.replace('#', '').trim();
  const full =
    value.length === 3
      ? value
          .split('')
          .map((c) => c + c)
          .join('')
      : value;
  const int = Number.parseInt(full, 16);
  if (Number.isNaN(int)) return [0, 0, 0];
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}

function rgba([r, g, b]: Rgb, alpha: number): string {
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** The palette the canvas paints with, read from the design tokens (never hex). */
interface Palette {
  cognac: Rgb;
  peach: Rgb;
  rose: Rgb;
}

function readPalette(el: HTMLElement): Palette {
  const styles = getComputedStyle(el);
  // Every colour comes from the Everlasting Beauty palette tokens, resolved at
  // runtime, so the canvas never hard-codes a value and stays on-palette.
  const read = (name: string): Rgb => hexToRgb(styles.getPropertyValue(name).trim());
  return {
    cognac: read('--so-cognac'),
    peach: read('--so-peach'),
    rose: read('--so-rose-quartz'),
  };
}

/** One dot on the sphere: its resting unit position, a tone, and a twinkle phase. */
interface GlobeDot {
  x: number;
  y: number;
  z: number;
  warm: boolean; // peach (true) or cognac (false), for gentle variety
  twinklePhase: number;
}

/** A server pin fixed on the surface, lighting up as it turns to the front. */
interface Pin {
  x: number;
  y: number;
  z: number;
  pulsePhase: number;
  pulseSpeed: number;
}

/** Spread the dots evenly over the sphere with a Fibonacci lattice. */
function buildDots(count: number): GlobeDot[] {
  const dots: GlobeDot[] = [];
  const golden = Math.PI * (1 + Math.sqrt(5));
  for (let i = 0; i < count; i += 1) {
    // y walks evenly from pole to pole; the golden angle spins each ring so the
    // points never line up into visible seams.
    const y = 1 - (i / (count - 1)) * 2;
    const radius = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * i;
    dots.push({
      x: Math.cos(theta) * radius,
      y,
      z: Math.sin(theta) * radius,
      warm: i % 3 === 0,
      twinklePhase: (i % 17) / 17 * Math.PI * 2,
    });
  }
  return dots;
}

/** Place a handful of pins by latitude and longitude, in degrees. */
function buildPins(): Pin[] {
  const spots: [number, number][] = [
    [42, -18],
    [18, 46],
    [-24, 24],
    [52, 96],
    [-34, 138],
    [8, -72],
    [36, 158],
  ];
  return spots.map(([latDeg, lonDeg], i) => {
    const lat = (latDeg * Math.PI) / 180;
    const lon = (lonDeg * Math.PI) / 180;
    return {
      x: Math.cos(lat) * Math.sin(lon),
      y: Math.sin(lat),
      z: Math.cos(lat) * Math.cos(lon),
      pulsePhase: (i / 7) * Math.PI * 2,
      pulseSpeed: 1.1 + (i % 3) * 0.35,
    };
  });
}

/**
 * The dotted globe: the "any Linux server, anywhere" beat in our warm glow. A
 * sphere is drawn as a field of dots that turns slowly behind a warm rim glow,
 * with a handful of server pins that light and softly pulse as they rotate to
 * the front and fade as they slip past the edge. Calm and premium, not busy.
 *
 * It mirrors the node network's cheap-canvas pattern exactly: a single canvas
 * painted in device pixels (ratio capped at 2) on a 30fps `requestAnimationFrame`
 * budget, every colour resolved from the palette tokens. The loop only runs while
 * the section is on screen (an IntersectionObserver pauses it when scrolled away)
 * and while the tab is visible, and the canvas is sized from a ResizeObserver.
 * Under a reduce-motion preference there is no loop at all: a single still,
 * composed frame is painted once with its pins lit and no rotation. The canvas is
 * purely decorative and hidden from assistive technology.
 */
function GlobeCanvas({ className }: { className?: string }) {
  const reduced = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dotsRef = useRef<GlobeDot[]>([]);
  const pinsRef = useRef<Pin[]>([]);
  if (dotsRef.current.length === 0) dotsRef.current = buildDots(DOT_COUNT);
  if (pinsRef.current.length === 0) pinsRef.current = buildPins();

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let palette = readPalette(container);
    const start = performance.now();

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      width = container.clientWidth;
      height = container.clientHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      palette = readPalette(container);
    };

    const drawFrame = (time: number) => {
      const dots = dotsRef.current;
      const pins = pinsRef.current;
      const cx = width * 0.5;
      const cy = height * 0.5;
      const globeR = Math.min(width * 0.46, height * 0.5, 300);
      ctx.clearRect(0, 0, width, height);

      const rot = time * ROTATION_SPEED;
      const cosR = Math.cos(rot);
      const sinR = Math.sin(rot);
      const cosT = Math.cos(GLOBE_TILT);
      const sinT = Math.sin(GLOBE_TILT);

      // Turn a resting unit position into a screen point plus a front factor:
      // 1 when the point faces the viewer, 0 at the terminator, negative behind.
      const project = (bx: number, by: number, bz: number) => {
        const rx = bx * cosR + bz * sinR;
        const rz = -bx * sinR + bz * cosR;
        const ty = by * cosT - rz * sinT;
        const tz = by * sinT + rz * cosT;
        return { sx: cx + rx * globeR, sy: cy - ty * globeR, front: tz };
      };

      // The warm rim glow hugging the sphere's edge, brightest at the horizon and
      // fading outward into the dark, like an ember-lit planet.
      const rim = ctx.createRadialGradient(cx, cy, globeR * 0.58, cx, cy, globeR * 1.42);
      rim.addColorStop(0, rgba(palette.cognac, 0));
      rim.addColorStop(0.52, rgba(palette.cognac, 0.06));
      rim.addColorStop(0.72, rgba(palette.cognac, 0.42));
      rim.addColorStop(0.82, rgba(palette.peach, 0.24));
      rim.addColorStop(1, rgba(palette.peach, 0));
      ctx.fillStyle = rim;
      ctx.fillRect(0, 0, width, height);

      // The sphere as a field of dots. Only the front hemisphere is painted, its
      // dots fading toward the rim, so the curvature reads without back-face cost.
      for (const dot of dots) {
        const p = project(dot.x, dot.y, dot.z);
        if (p.front < 0) continue;
        const twinkle = 0.85 + 0.15 * Math.sin(time * 0.8 + dot.twinklePhase);
        const alpha = (0.16 + 0.72 * p.front) * twinkle;
        const size = 0.7 + 1.3 * p.front;
        ctx.fillStyle = rgba(dot.warm ? palette.peach : palette.cognac, alpha);
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, size, 0, Math.PI * 2);
        ctx.fill();
      }

      // Server pins: a warm halo, a bright core, and a fine ring, pulsing gently
      // and fading as they slip toward the horizon so only the near side lights.
      for (const pin of pins) {
        const p = project(pin.x, pin.y, pin.z);
        if (p.front <= 0.04) continue;
        const pulse = 0.5 + 0.5 * Math.sin(time * pin.pulseSpeed + pin.pulsePhase);
        const reach = p.front;

        const halo = ctx.createRadialGradient(p.sx, p.sy, 0, p.sx, p.sy, 16 * (0.7 + 0.3 * pulse));
        halo.addColorStop(0, rgba(palette.peach, 0.5 * reach * (0.5 + 0.5 * pulse)));
        halo.addColorStop(1, rgba(palette.peach, 0));
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, 16 * (0.7 + 0.3 * pulse), 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = rgba(palette.rose, (0.7 + 0.3 * pulse) * reach);
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, 2.4, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = rgba(palette.peach, 0.5 * reach * pulse);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, 4 + 2 * pulse, 0, Math.PI * 2);
        ctx.stroke();
      }
    };

    resize();

    if (reduced) {
      // A single composed, still-glowing frame, held at an angle that lights a
      // few pins on the near face. No loop, no per-frame work.
      const STILL_TIME = 2.4;
      drawFrame(STILL_TIME);
      const staticResize = () => {
        resize();
        drawFrame(STILL_TIME);
      };
      const observer = new ResizeObserver(staticResize);
      observer.observe(container);
      return () => observer.disconnect();
    }

    let raf = 0;
    let last = 0;
    let running = false;
    let onScreen = true;

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (now - last < FRAME_INTERVAL) return;
      last = now;
      drawFrame((now - start) / 1000);
    };

    const shouldRun = () => onScreen && !document.hidden;

    const startLoop = () => {
      if (running || !shouldRun()) return;
      running = true;
      raf = requestAnimationFrame(loop);
    };

    const stopLoop = () => {
      if (!running) return;
      running = false;
      cancelAnimationFrame(raf);
    };

    const resizeObserver = new ResizeObserver(() => {
      resize();
      if (!running) drawFrame((performance.now() - start) / 1000);
    });
    resizeObserver.observe(container);

    // Pause entirely when the section scrolls off screen: no wasted frames.
    const intersection = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        onScreen = entry.isIntersecting;
        if (onScreen) startLoop();
        else stopLoop();
      },
      { threshold: 0 },
    );
    intersection.observe(container);

    const onVisibility = () => {
      if (shouldRun()) startLoop();
      else stopLoop();
    };
    document.addEventListener('visibilitychange', onVisibility);

    startLoop();

    return () => {
      stopLoop();
      resizeObserver.disconnect();
      intersection.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [reduced]);

  return (
    <div ref={containerRef} aria-hidden className={className}>
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  );
}

/**
 * The globe beat: SlideOps reaches any Linux server the Operator owns over SSH,
 * wherever it runs, and never owns the infrastructure. A short heading and copy
 * sit beside a dotted, slowly turning globe with lit server pins, on the warm
 * dark hero-world so it reads as a deliberate dark beat in the page's rhythm.
 */
export function AnyServer() {
  return (
    <section id="reach" className="so-hero-world relative isolate overflow-hidden">
      {/* Ambient warmth behind the whole beat, all decorative. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <Glow color="ember" size="44rem" x="82%" y="52%" pulse />
        <Glow color="warm" size="40rem" x="20%" y="30%" pulse />
        <Grain style={{ position: 'absolute' }} />
      </div>

      <div className="mx-auto grid max-w-6xl items-center gap-10 px-6 py-20 md:grid-cols-2 md:py-28">
        <div className="max-w-xl">
          <Reveal kind="fade">
            <span className="inline-flex items-center gap-2 rounded-pill border border-[color:var(--so-hero-hairline)] bg-[var(--so-hero-panel)] px-3 py-1 text-xs font-medium uppercase tracking-wide text-[color:var(--so-hero-ink-faint)]">
              Any Linux server, anywhere
            </span>
          </Reveal>

          <WordReveal
            as="h2"
            text={headline}
            delay={0.1}
            stagger={0.08}
            wordClassName={warmWord}
            className="mt-6 font-display text-4xl font-semibold tracking-tight text-[color:var(--so-hero-ink)] md:text-5xl"
          />

          <Reveal kind="fade" delay={0.3}>
            <p className="mt-6 text-lg leading-relaxed text-[color:var(--so-hero-ink-soft)]">
              SlideOps reaches any Linux server you own over SSH, wherever it runs: a cloud
              instance, a rented box, a machine in your own rack, or a home lab. There is no agent to
              install and nothing to hand over. It never owns your infrastructure. You do.
            </p>
          </Reveal>

          <Reveal kind="fade" delay={0.45}>
            <ul className="mt-9 flex flex-col gap-3">
              {assurances.map(({ icon: Icon, label }) => (
                <li key={label} className="flex items-center gap-3">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[color:var(--so-hero-hairline)] bg-[var(--so-hero-panel)] text-[color:var(--so-peach)]">
                    <Icon width={18} height={18} aria-hidden />
                  </span>
                  <span className="text-sm leading-relaxed text-[color:var(--so-hero-ink-soft)]">
                    {label}
                  </span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>

        {/* The globe leads visually on desktop; on mobile it sits below the copy. */}
        <div className="order-first md:order-none">
          <GlobeCanvas className="relative mx-auto aspect-square w-full max-w-[34rem]" />
        </div>
      </div>
    </section>
  );
}
