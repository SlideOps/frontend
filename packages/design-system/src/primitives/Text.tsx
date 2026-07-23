import { createElement, forwardRef, type HTMLAttributes } from 'react';
import { cn } from '../lib/cn';

export type TextVariant =
  | 'display'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'body'
  | 'body-sm'
  | 'caption'
  | 'code';

export type TextTone = 'primary' | 'secondary' | 'brand' | 'accent';

export interface TextProps extends HTMLAttributes<HTMLElement> {
  variant?: TextVariant;
  tone?: TextTone;
  as?: keyof JSX.IntrinsicElements;
}

const variantClasses: Record<TextVariant, string> = {
  display: 'font-display text-5xl md:text-6xl font-semibold tracking-tight',
  h1: 'font-display text-3xl md:text-4xl font-semibold tracking-tight',
  h2: 'font-display text-2xl md:text-3xl font-semibold',
  h3: 'text-xl font-semibold',
  h4: 'text-lg font-semibold',
  body: 'text-base leading-relaxed',
  'body-sm': 'text-sm leading-relaxed',
  caption: 'text-xs uppercase tracking-wide',
  code: 'font-mono text-sm',
};

const toneClasses: Record<TextTone, string> = {
  primary: 'text-ink',
  secondary: 'text-ink-muted',
  brand: 'text-brand',
  accent: 'text-accent',
};

const defaultTag: Record<TextVariant, keyof JSX.IntrinsicElements> = {
  display: 'h1',
  h1: 'h1',
  h2: 'h2',
  h3: 'h3',
  h4: 'h4',
  body: 'p',
  'body-sm': 'p',
  caption: 'span',
  code: 'code',
};

export const Text = forwardRef<HTMLElement, TextProps>(function Text(
  { variant = 'body', tone = 'primary', as, className, ...rest },
  ref,
) {
  const tag = as ?? defaultTag[variant];
  return createElement(tag, {
    ref,
    className: cn(variantClasses[variant], toneClasses[tone], className),
    ...rest,
  });
});
