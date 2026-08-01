import { Card, Text } from '@slideops/design-system';
import { Logo } from '@slideops/icons';
import type { ReactNode } from 'react';

interface AuthLayoutProps {
  title: string;
  description?: string;
  children: ReactNode;
  /** Optional footer row, for example a link to the other auth screen. */
  footer?: ReactNode;
}

/** The centered card frame shared by every Operator authentication screen. */
export function AuthLayout({ title, description, children, footer }: AuthLayoutProps) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-app px-4 py-12 text-ink">
      <div className="w-full max-w-md">
        <Card raised>
          <div className="mb-6 flex flex-col items-center text-center">
            <Logo size={34} />
            <Text variant="h2" className="mt-6">
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
        {footer ? <div className="mt-4 text-center">{footer}</div> : null}
      </div>
    </div>
  );
}
