import { motion } from 'framer-motion';
import type { ElementType, ReactNode } from 'react';
import { useReducedMotion } from './useReducedMotion';
import { wordRevealVariants } from './variants';

interface WordRevealProps {
  /** The heading text to reveal one word at a time. */
  text: string;
  /** Render as a heading level or any element. Defaults to `h2`. */
  as?: ElementType;
  /** Seconds between each word appearing. */
  stagger?: number;
  /** A delay before the first word appears, in seconds. */
  delay?: number;
  className?: string;
  /**
   * Optional per-word decoration. Return a class name (for example to warm a key
   * word into an accent tone) for a given word and its index. This lets the
   * later hero highlight words without the primitive knowing the copy.
   */
  wordClassName?: (word: string, index: number) => string | undefined;
  /** Rendered visually hidden state cannot include interactive children. */
  children?: never;
}

/**
 * Reveal a heading word by word as it scrolls into view.
 *
 * Each word rises and fades in just after the one before it, so the line
 * assembles itself. Built for the later hero headline, but generic: it takes any
 * string and an optional per-word class hook for warming key words into accent
 * tones. The full text is always present for assistive technology as a single
 * accessible label, so screen readers never hear a fragmented, word-split line.
 *
 * Under a reduce-motion preference the whole heading renders at once, complete
 * and readable, with no per-word motion.
 */
export function WordReveal({
  text,
  as = 'h2',
  stagger = 0.08,
  delay = 0,
  className,
  wordClassName,
}: WordRevealProps): ReactNode {
  const reduced = useReducedMotion();
  const words = text.split(' ');
  const Tag = motion(as as ElementType);
  const { container, word } = wordRevealVariants({ stagger, delay });

  if (reduced) {
    const Static = as as ElementType;
    return (
      <Static className={className}>
        {words.map((value, index) => (
          <span key={`${value}-${index}`} className={wordClassName?.(value, index)}>
            {value}
            {index < words.length - 1 ? ' ' : ''}
          </span>
        ))}
      </Static>
    );
  }

  return (
    <Tag
      className={className}
      aria-label={text}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '0px 0px -10% 0px' }}
      variants={container}
    >
      {words.map((value, index) => (
        <motion.span
          key={`${value}-${index}`}
          variants={word}
          // Inline-block so the transform lifts the word without collapsing the
          // line box; a trailing space keeps natural word spacing.
          style={{ display: 'inline-block', willChange: 'transform, opacity' }}
          aria-hidden
        >
          <span className={wordClassName?.(value, index)}>{value}</span>
          {index < words.length - 1 ? ' ' : ''}
        </motion.span>
      ))}
    </Tag>
  );
}
