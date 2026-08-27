import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '../lib/cn';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Lift the card off the page with a warm shadow. */
  raised?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { raised = false, className, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        'rounded-md border border-border bg-surface p-6',
        raised ? 'shadow-md' : '',
        className,
      )}
      {...rest}
    />
  );
});
