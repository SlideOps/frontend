import { Card, Text } from '@slideops/design-system';
import { Lock, Logo } from '@slideops/icons';
import type { ReactNode } from 'react';

interface AuthLayoutProps {
  title: string;
  description?: string;
  children: ReactNode;
}

/** The centered card frame shared by the Admin authentication screens. */
export function AuthLayout({ title, description, children }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-app px-4 py-12 text-ink">
      <Card className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <Logo size={30} />
          <span className="mt-5 inline-flex items-center gap-2 rounded-pill bg-subtle px-3 py-1 text-xs font-medium uppercase tracking-wide text-brand">
            <Lock width={13} height={13} aria-hidden />
            Control plane
          </span>
          <Text variant="h3" className="mt-4">
            {title}
          </Text>
          {description ? (
            <Text variant="body-sm" tone="secondary" className="mt-2">
              {description}
            </Text>
          ) : null}
        </div>
        {children}
      </Card>
    </div>
  );
}
