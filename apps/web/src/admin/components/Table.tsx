import { cn } from '@slideops/design-system';
import type { ReactNode, TdHTMLAttributes, ThHTMLAttributes } from 'react';

/*
 * A dense, accessible table for the control plane. It wraps the table in a
 * horizontally scrollable region so wide content never pushes the page sideways,
 * and uses semantic table elements so rows and headers are announced correctly.
 * Colors are semantic tokens only.
 */

export function Table({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface">
      <table className="w-full min-w-full border-collapse text-left text-sm" aria-label={label}>
        {children}
      </table>
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return (
    <thead className="border-b border-border bg-subtle/40">
      <tr>{children}</tr>
    </thead>
  );
}

export function TH({
  children,
  className,
  ...rest
}: ThHTMLAttributes<HTMLTableCellElement> & { children: ReactNode }) {
  return (
    <th
      scope="col"
      className={cn(
        'whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-ink-muted',
        className,
      )}
      {...rest}
    >
      {children}
    </th>
  );
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-border">{children}</tbody>;
}

export function TR({
  children,
  onClick,
  interactive = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  interactive?: boolean;
}) {
  if (interactive && onClick) {
    return (
      <tr
        onClick={onClick}
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onClick();
          }
        }}
        className="cursor-pointer transition-colors duration-fast ease-standard hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus"
      >
        {children}
      </tr>
    );
  }
  return <tr>{children}</tr>;
}

export function TD({
  children,
  className,
  ...rest
}: TdHTMLAttributes<HTMLTableCellElement> & { children: ReactNode }) {
  return (
    <td className={cn('px-4 py-3 align-middle text-ink', className)} {...rest}>
      {children}
    </td>
  );
}
