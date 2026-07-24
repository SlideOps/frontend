import { Mark } from '@slideops/icons';
import { useEffect, useRef } from 'react';
import { useReducedMotion } from '../motion';

interface NodeNetworkProps {
  /**
   * How many orbiting nodes radiate from the core. Higher reads richer, lower
   * calmer. Exposed so later sections can reuse the network at a different
   * density without forking the component.
   */
  density?: number;
  /** Vertical anchor of the core as a fraction of height (0 top, 1 bottom). */
  coreY?: number;
  className?: string;
}

/** One node orbiting the core: its resting orbit plus the phases that breathe it. */
interface OrbitNode {
  angle: number; // resting angle around the core
  radius: number; // orbit radius as a fraction of the field radius
  size: number; // core disc radius in CSS pixels
  warm: boolean; // cognac (true) or peach (false) disc, for gentle variety
  driftAngle: number; // angular drift amplitude
  driftRadius: number; // radial drift amplitude, as a fraction
  driftPhase: number; // phase offset for the drift
  driftSpeed: number; // drift speed
  pulsePhase: number; // phase offset for the brightness pulse
  flowPhase: number; // phase offset for the travelling link pulse
  flowSpeed: number; // speed of the travelling pulse along the link
}

type Rgb = [number, number, number];

/** Cap the pixel ratio so the canvas stays cheap on dense displays. */
const MAX_DPR = 2;
/** Draw at a calm 30fps; the motion is slow, so a smaller budget is invisible. */
const FRAME_INTERVAL = 1000 / 30;
const DEFAULT_DENSITY = 7;
const DEFAULT_CORE_Y = 0.66;

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

/** Build the orbit once, spreading nodes around the core with a little variety. */
function buildNodes(count: number): OrbitNode[] {
  const nodes: OrbitNode[] = [];
  for (let i = 0; i < count; i += 1) {
    const even = i / count;
    // Even angular spread with a small jitter so the ring never looks mechanical.
    const angle = even * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
    // Alternate the orbit radius for depth, so nodes sit at two soft distances.
    const radius = (i % 2 === 0 ? 0.78 : 0.98) + (Math.random() - 0.5) * 0.08;
    nodes.push({
      angle,
      radius,
      size: 3.4 + Math.random() * 1.8,
      warm: i % 2 === 0,
      driftAngle: 0.04 + Math.random() * 0.05,
      driftRadius: 0.03 + Math.random() * 0.04,
      driftPhase: Math.random() * Math.PI * 2,
      driftSpeed: 0.22 + Math.random() * 0.18,
      pulsePhase: Math.random() * Math.PI * 2,
      flowPhase: Math.random(),
      flowSpeed: 0.14 + Math.random() * 0.12,
    });
  }
  return nodes;
}

/**
 * The living node network: the Capability engine core radiating to orbiting
 * nodes (the servers and Capabilities). Links carry a soft warm flow, nodes
 * drift and breathe, and the whole field pulses gently. It is the central
 * metaphor made living, kept calm rather than busy.
 *
 * It is deliberately cheap: a single canvas painted in device pixels (ratio
 * capped) at a 30fps budget on `requestAnimationFrame`, every colour resolved
 * from the palette tokens. The loop only runs while the hero is on screen (an
 * IntersectionObserver pauses it when scrolled away) and while the tab is
 * visible. Under a reduce-motion preference there is no loop at all: a single
 * still, composed, still-glowing frame is painted once. The canvas is purely
 * decorative and hidden from assistive technology.
 */
export function NodeNetwork({
  density = DEFAULT_DENSITY,
  coreY = DEFAULT_CORE_Y,
  className,
}: NodeNetworkProps) {
  const reduced = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<OrbitNode[]>([]);
  if (nodesRef.current.length !== density) {
    nodesRef.current = buildNodes(density);
  }

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
      const nodes = nodesRef.current;
      const cx = width * 0.5;
      const cy = height * coreY;
      const fieldR = Math.min(width * 0.42, 560);
      const fieldRy = Math.min(height * 0.52, 420);
      ctx.clearRect(0, 0, width, height);

      // Faint concentric orbit rings give the core a sense of a field.
      for (let ring = 1; ring <= 3; ring += 1) {
        ctx.beginPath();
        ctx.ellipse(cx, cy, fieldR * (ring / 3.4), fieldRy * (ring / 3.4), 0, 0, Math.PI * 2);
        ctx.strokeStyle = rgba(palette.cognac, 0.05);
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Resolve every node position first, then draw links under the discs.
      const points = nodes.map((node) => {
        const drift = Math.sin(time * node.driftSpeed + node.driftPhase);
        const angle = node.angle + node.driftAngle * drift;
        const radius = node.radius * (1 + node.driftRadius * drift);
        const pulse = 0.6 + 0.4 * (0.5 + 0.5 * Math.sin(time * 0.7 + node.pulsePhase));
        return {
          node,
          x: cx + Math.cos(angle) * fieldR * radius,
          y: cy + Math.sin(angle) * fieldRy * radius,
          pulse,
        };
      });

      // Links: a dim underlay, a warmer thread, and a travelling flow pulse.
      for (const point of points) {
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(point.x, point.y);
        ctx.strokeStyle = rgba(palette.cognac, 0.05);
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(point.x, point.y);
        ctx.strokeStyle = rgba(palette.cognac, 0.16 * point.pulse);
        ctx.lineWidth = 1;
        ctx.stroke();

        // A soft pulse travels the link, fading in at the core and out at the
        // node, so the network reads as alive with flowing signal.
        const flow = (time * point.node.flowSpeed + point.node.flowPhase) % 1;
        const envelope = Math.sin(flow * Math.PI);
        const fx = cx + (point.x - cx) * flow;
        const fy = cy + (point.y - cy) * flow;
        const flowGlow = ctx.createRadialGradient(fx, fy, 0, fx, fy, 6);
        flowGlow.addColorStop(0, rgba(palette.peach, 0.9 * envelope));
        flowGlow.addColorStop(1, rgba(palette.peach, 0));
        ctx.fillStyle = flowGlow;
        ctx.beginPath();
        ctx.arc(fx, fy, 6, 0, Math.PI * 2);
        ctx.fill();
      }

      // Nodes: a soft halo, a warm disc, and a fine rose ring.
      for (const point of points) {
        const disc = point.node.warm ? palette.cognac : palette.peach;
        const halo = ctx.createRadialGradient(
          point.x,
          point.y,
          0,
          point.x,
          point.y,
          point.node.size * 3.4,
        );
        halo.addColorStop(0, rgba(palette.peach, 0.18 * point.pulse));
        halo.addColorStop(1, rgba(palette.peach, 0));
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(point.x, point.y, point.node.size * 3.4, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = rgba(disc, 0.92 * point.pulse);
        ctx.beginPath();
        ctx.arc(point.x, point.y, point.node.size, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = rgba(palette.rose, 0.5 * point.pulse);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(point.x, point.y, point.node.size + 1.5, 0, Math.PI * 2);
        ctx.stroke();
      }

      // The core nucleus glow, behind the DOM mark that sits on top of the canvas.
      const coreGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 96);
      coreGlow.addColorStop(0, rgba(palette.cognac, 0.5));
      coreGlow.addColorStop(0.55, rgba(palette.cognac, 0.16));
      coreGlow.addColorStop(1, rgba(palette.cognac, 0));
      ctx.fillStyle = coreGlow;
      ctx.beginPath();
      ctx.arc(cx, cy, 96, 0, Math.PI * 2);
      ctx.fill();
    };

    resize();

    // Position the DOM core mark over the canvas core so links appear to
    // radiate from behind it, in both the animated and the static paths.
    const placeCore = () => {
      container.style.setProperty('--so-core-x', '50%');
      container.style.setProperty('--so-core-y', `${coreY * 100}%`);
    };
    placeCore();

    if (reduced) {
      // A single composed, still-glowing frame. No loop, no per-frame work.
      drawFrame(0);
      const staticResize = () => {
        resize();
        drawFrame(0);
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
      placeCore();
      if (!running) drawFrame((performance.now() - start) / 1000);
    });
    resizeObserver.observe(container);

    // Pause entirely when the hero scrolls off screen: no wasted frames.
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
  }, [coreY, reduced, density]);

  return (
    <div ref={containerRef} aria-hidden className={className}>
      <canvas ref={canvasRef} className="h-full w-full" />
      <div
        className="pointer-events-none absolute"
        style={{
          left: 'var(--so-core-x, 50%)',
          top: 'var(--so-core-y, 66%)',
          transform: 'translate(-50%, -50%)',
          filter: 'drop-shadow(0 0 18px var(--so-glow-warm))',
        }}
      >
        {/* The scale breathes independently of the centering transform above, so
            the mark pulses in place. Halted to a still mark under reduced motion. */}
        <span className={reduced ? 'block' : 'so-core-breathe block'}>
          <Mark size={62} />
        </span>
      </div>
    </div>
  );
}
