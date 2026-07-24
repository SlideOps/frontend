import type { Plan } from '@slideops/api-client';
import { Card, Text } from '@slideops/design-system';
import { AlertTriangle, ListChecks, RefreshCw, ShieldCheck } from '@slideops/icons';
import { Guidance } from '@slideops/tooltips';
import { RiskBadge } from './Badges';

/*
 * The Plan, laid out for review: every step in order with its risk, the risks
 * gathered plainly, the rollback, and how the result will be verified. This is
 * what an Operator reads before approving. It is read-only; the approval action
 * lives with the Operation flow.
 */
export function PlanReview({ plan }: { plan: Plan }) {
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <div className="mb-4 flex items-center gap-2">
          <ListChecks width={18} height={18} className="text-brand" aria-hidden />
          <Text variant="h4">Steps</Text>
          <Guidance for="operation.steps" />
        </div>
        <ol className="flex flex-col gap-4">
          {plan.steps.map((step, index) => (
            <li key={step.id} className="flex gap-3">
              <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-pill bg-subtle text-xs font-medium text-brand">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Text variant="body-sm" className="font-medium">
                    {step.title}
                  </Text>
                  <RiskBadge risk={step.risk} />
                </div>
                <Text variant="body-sm" tone="secondary" className="mt-1">
                  {step.description}
                </Text>
                {step.effect ? (
                  <Text variant="body-sm" tone="secondary" className="mt-1">
                    Effect: {step.effect}
                  </Text>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {plan.risks.length > 0 ? (
          <Card>
            <div className="mb-3 flex items-center gap-2">
              <AlertTriangle width={18} height={18} className="text-warning" aria-hidden />
              <Text variant="h4">Risks</Text>
              <Guidance for="operation.risks" />
            </div>
            <ul className="flex list-disc flex-col gap-2 pl-5">
              {plan.risks.map((risk, index) => (
                <li key={index}>
                  <Text variant="body-sm" tone="secondary">
                    {risk}
                  </Text>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        <Card>
          <div className="mb-3 flex items-center gap-2">
            <RefreshCw width={18} height={18} className="text-info" aria-hidden />
            <Text variant="h4">Rollback</Text>
            <Guidance for="operation.rollback" />
          </div>
          <Text variant="body-sm" tone="secondary">
            {plan.rollback}
          </Text>
        </Card>
      </div>

      <Card>
        <div className="mb-3 flex items-center gap-2">
          <ShieldCheck width={18} height={18} className="text-brand" aria-hidden />
          <Text variant="h4">How it is verified</Text>
          <Guidance for="operation.verificationStrategy" />
        </div>
        <Text variant="body-sm" tone="secondary">
          {plan.verification_strategy}
        </Text>
      </Card>
    </div>
  );
}
