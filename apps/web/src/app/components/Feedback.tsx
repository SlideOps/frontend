import type { ApiError } from '@slideops/api-client';
import { Text } from '@slideops/design-system';
import { AlertTriangle, Loader2 } from '@slideops/icons';

/** A calm inline loading indicator with an accessible status role. */
export function Loading({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 py-8 text-ink-muted" role="status">
      <Loader2 width={18} height={18} className="animate-spin" aria-hidden />
      <Text variant="body-sm" tone="secondary">
        {label}
      </Text>
    </div>
  );
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
