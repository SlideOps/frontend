import type { Verification } from '@slideops/api-client';
import { Card, Text } from '@slideops/design-system';
import { CheckCircle2, XCircle } from '@slideops/icons';
import { Guidance } from '@slideops/tooltips';

/*
 * The Verification result: whether every check passed, with each check and the
 * evidence behind it. Verification always follows execution, so this is the
 * proof an Operation delivered what its plan promised.
 */
export function VerificationView({ verification }: { verification: Verification }) {
  return (
    <Card>
      <div className="mb-4 flex items-center gap-2">
        {verification.passed ? (
          <CheckCircle2 width={20} height={20} className="text-success" aria-hidden />
        ) : (
          <XCircle width={20} height={20} className="text-danger" aria-hidden />
        )}
        <Text variant="h4">
          {verification.passed ? 'Verification passed' : 'Verification did not pass'}
        </Text>
        <Guidance for="operation.verification" />
      </div>
      <ul className="flex flex-col divide-y divide-border">
        {verification.checks.map((check, index) => (
          <li key={index} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
            {check.passed ? (
              <CheckCircle2
                width={18}
                height={18}
                className="mt-0.5 shrink-0 text-success"
                aria-hidden
              />
            ) : (
              <XCircle width={18} height={18} className="mt-0.5 shrink-0 text-danger" aria-hidden />
            )}
            <div className="min-w-0">
              <Text variant="body-sm" className="font-medium">
                {check.name}
              </Text>
              {check.detail ? (
                <Text variant="body-sm" tone="secondary" className="mt-0.5 break-words">
                  {check.detail}
                </Text>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
