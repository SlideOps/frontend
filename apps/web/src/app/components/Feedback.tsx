import type { ApiError } from '@slideops/api-client';
import { Text } from '@slideops/design-system';
import { AlertTriangle } from '@slideops/icons';
import { LogoLoader } from '../../components/LogoLoader';

/** A calm inline loading indicator: the fox mark assembling above its label. */
export function Loading({ label = 'Loading' }: { label?: string }) {
  return <LogoLoader size="sm" label={label} />;
}

/** A quiet error panel that shows the backend message in plain language. */
export function ErrorNote({ error }: { error: ApiError }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-md border border-border bg-subtle px-4 py-3"
    >
      <AlertTriangle width={18} height={18} className="mt-0.5 shrink-0 text-danger" aria-hidden />
      <div>
        <Text variant="body-sm" className="font-medium">
          This did not load
        </Text>
        <Text variant="body-sm" tone="secondary" className="mt-0.5">
          {error.message}
        </Text>
      </div>
    </div>
  );
}
