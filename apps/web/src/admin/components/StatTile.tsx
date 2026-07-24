import { Card, Text } from '@slideops/design-system';
import { Guidance } from '@slideops/tooltips';

/** A headline number with its label and optional guidance. The unit of the overview. */
export function StatTile({
  label,
  value,
  guidanceKey,
  tone = 'primary',
}: {
  label: string;
  value: string | number;
  guidanceKey?: string;
  tone?: 'primary' | 'danger' | 'success' | 'warning';
}) {
  const valueClass =
    tone === 'danger'
      ? 'text-danger'
      : tone === 'success'
        ? 'text-success'
        : tone === 'warning'
          ? 'text-warning'
          : 'text-ink';
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2">
        <Text variant="caption" tone="secondary">
          {label}
        </Text>
        {guidanceKey ? <Guidance for={guidanceKey} /> : null}
      </div>
      <p className={`mt-2 text-2xl font-semibold ${valueClass}`}>{value}</p>
    </Card>
  );
}
