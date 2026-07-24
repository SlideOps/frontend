import { cn } from '@slideops/design-system';
import { motion, useScroll, useTransform, type MotionStyle } from 'framer-motion';
import { useRef } from 'react';
import { Grain } from './Grain';
import { useReducedMotion } from './useReducedMotion';

/** Which way the fold reads: a warm-dark sheet peeling to light, or the reverse. */
export type FoldDirection = 'dark-to-light' | 'light-to-dark';

/**
 * How prominent the fold is. The band grows taller and the curl sweeps further
 * with density, so the same primitive can be a quiet seam between two calm
 * sections or a full tactile beat between two worlds.
 */
export type FoldDensity = 'subtle' | 'standard' | 'bold';

const bandHeight: Record<FoldDensity, string> = {
  subtle: '9rem',
  standard: '15rem',
  bold: '21rem',
};

/** The height of the curling lip (the rounded underside catching light), in rem. */
const CURL_REM = 3.25;

/** Where the static, reduced-motion seam rests: a mid-peel, so both faces show. */
const STILL_PEEL = '-46%';

interface SectionFoldProps {
  /** Dark-to-light (the default) peels the warm dark away to the warm paper. */
  direction?: FoldDirection;
  /** How tall and pronounced the fold is. Defaults to `standard`. */
  density?: FoldDensity;
  className?: string;
}

/**
 * SectionFold: the paper-curl transition between two sections.
 *
 * This is the fold motif from the inspiration still made into a scroll-driven
 * beat. A warm-dark sheet lies over a warm-light underside; as the operator
 * scrolls the band through the viewport, the sheet peels up and off, its rounded
 * lip catching warm light along the crease, revealing the paper beneath. It
 * rhymes with the origami fox: a single tactile fold between a dark hero-world
 * and a light section. Reverse it with `direction="light-to-dark"` so a later
 * boundary can fold the other way.
 *
 * It is deliberately cheap. The peel is driven by Framer Motion's `useScroll`
 * progress and applied only through `transform` (a translate on the sheet, a
 * rotate on the lip), so there is no per-frame layout or paint of geometry, and
 * the work only happens while the band is on screen. Colour is always a design
 * token, so it stays on-palette in either app theme, and the surfaces match the
 * fixed marketing ink and paper so the fold reads continuous with the sections
 * it joins.
 *
 * Under a reduce-motion preference it renders a still, composed seam: the sheet
 * frozen at a gentle mid-peel with its warm lip showing, a soft folded edge and
 * no animation. It is purely decorative and hidden from assistive technology.
 */
export function SectionFold({
  direction = 'dark-to-light',
  density = 'standard',
  className,
}: SectionFoldProps) {
  const reduced = useReducedMotion();
  const bandRef = useRef<HTMLDivElement>(null);

  // Progress runs 0 -> 1 as the band travels up through the viewport. The peel is
  // mapped onto the earlier, comfortable middle of that range so it completes
  // while the fold is centred rather than at the very edges of the screen.
  const { scrollYProgress } = useScroll({
    target: bandRef,
    offset: ['start end', 'end start'],
  });
  const sheetY = useTransform(scrollYProgress, [0.1, 0.66], ['0%', '-118%']);
  const lipRotate = useTransform(scrollYProgress, [0.1, 0.66], [14, 46]);

  const darkToLight = direction === 'dark-to-light';
  const undersideColor = darkToLight ? 'var(--so-marketing-paper)' : 'var(--so-marketing-ink)';
  const sheetColor = darkToLight ? 'var(--so-marketing-ink)' : 'var(--so-marketing-paper)';
  // The lip is the underside of the sheet curling toward us, catching warm light:
  // a shadowed crease at the top, a peach highlight rolling over, the underside
  // colour at the leading edge. Warm in both directions, like the inspiration.
  const lipGradient = darkToLight
    ? 'linear-gradient(to bottom, var(--so-cognac) 0%, var(--so-peach) 55%, var(--so-marketing-paper) 100%)'
    : 'linear-gradient(to bottom, var(--so-peach) 0%, var(--so-cognac) 50%, var(--so-marketing-ink) 100%)';

  const sheetStyle: MotionStyle = {
    height: `calc(100% + ${CURL_REM}rem)`,
    backgroundColor: sheetColor,
    willChange: 'transform',
    ...(reduced ? { transform: `translateY(${STILL_PEEL})` } : { y: sheetY }),
  };

  const lipStyle: MotionStyle = {
    height: `${CURL_REM}rem`,
    background: lipGradient,
    borderBottomLeftRadius: '45% 92%',
    borderBottomRightRadius: '45% 92%',
    boxShadow: 'var(--so-shadow-lg)',
    transformOrigin: 'top center',
    transformPerspective: 1000,
    ...(reduced ? { transform: 'rotateX(30deg)' } : { rotateX: lipRotate }),
  };

  return (
    <div
      ref={bandRef}
      aria-hidden
      className={cn('relative w-full overflow-hidden', className)}
      style={{ height: bandHeight[density], perspective: '1200px' }}
    >
      {/* The warm underside, revealed as the sheet peels away. */}
      <div className="absolute inset-0" style={{ backgroundColor: undersideColor }}>
        <Grain style={{ position: 'absolute' }} />
      </div>

      {/* The peeling sheet, with its curling lip along the bottom crease. */}
      <motion.div className="absolute inset-x-0 top-0" style={sheetStyle}>
        <Grain style={{ position: 'absolute' }} />
        <motion.div className="absolute inset-x-0 bottom-0" style={lipStyle} />
      </motion.div>
    </div>
  );
}
