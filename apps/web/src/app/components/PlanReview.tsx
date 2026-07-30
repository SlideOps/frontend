import type { Plan } from '@slideops/api-client';
import { Section, Text } from '@slideops/design-system';
import { AlertTriangle, RefreshCw, ShieldCheck } from '@slideops/icons';
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
    <div className="flex flex-col gap-8">
      <Section title="Steps" flush adornment={<Guidance for="operation.steps" />}>
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
      </Section>

      <div className="grid gap-8 md:grid-cols-2">
        {plan.risks.length > 0 ? (
          <Section
            title="Risks"
            adornment={
              <AlertTriangle width={16} height={16} className="text-warning" aria-hidden />
            }
          >
            <ul className="flex list-disc flex-col gap-2 pl-5">
              {plan.risks.map((risk, index) => (
                <li key={index}>
                  <Text variant="body-sm" tone="secondary">
                    {risk}
                  </Text>
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        <Section
          title="Rollback"
          adornment={<RefreshCw width={16} height={16} className="text-info" aria-hidden />}
        >
          <Text variant="body-sm" tone="secondary">
            {plan.rollback}
          </Text>
        </Section>
      </div>

      <Section
        title="How it is verified"
        adornment={<ShieldCheck width={16} height={16} className="text-brand" aria-hidden />}
      >
        <Text variant="body-sm" tone="secondary">
          {plan.verification_strategy}
        </Text>
      </Section>
    </div>
  );
}
