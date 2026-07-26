import { ApiError, planComposeStack, type StackPlan, type StackStep } from '@slideops/api-client';
import { Button, Card, Text } from '@slideops/design-system';
import { AlertTriangle, ArrowRight, Boxes, Database, Rocket, ScanSearch } from '@slideops/icons';
import { useState } from 'react';
import { Loading } from './Feedback';

/*
 * Planning a compose file as Capabilities.
 *
 * A compose file already says what the Operator wants. `image: postgres:16` means
 * a PostgreSQL server with a database and an account for their app — so rather
 * than making them install it by hand and copy a password into the environment,
 * this shows the plan that does all three and wires the credentials through.
 *
 * It plans and stops. Nothing here touches a server: the Operator reads what would
 * happen and decides. That gate is the promise the whole product rests on.
 */

const stepIcon = {
  install: Boxes,
  provision: Database,
  deploy: Rocket,
} as const;

const stepLabel = {
  install: 'Install',
  provision: 'Create',
  deploy: 'Deploy',
} as const;

/** One step of the plan, numbered so the order is unmistakable. */
function PlanStep({ step, index }: { step: StackStep; index: number }) {
  const Icon = stepIcon[step.kind];
  return (
    <li className="flex gap-4">
      <span className="flex flex-col items-center">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-brand">
          <Icon width={16} height={16} aria-hidden />
        </span>
      </span>
      <div className="min-w-0 flex-1 pb-5">
        <div className="flex flex-wrap items-center gap-2">
          <Text variant="body-sm" className="font-medium">
            {index + 1}. {step.title}
          </Text>
          <span className="rounded-pill bg-subtle px-2 py-0.5 text-xs text-ink-muted">
            {stepLabel[step.kind]}
          </span>
          <span className="font-mono text-xs text-ink-muted">{step.compose_service}</span>
        </div>
        <Text variant="body-sm" tone="secondary" className="mt-1">
          {step.detail}
        </Text>
        {step.secret_parameters && step.secret_parameters.length > 0 ? (
          <Text variant="caption" tone="secondary" className="mt-1 block">
            {step.secret_parameters.join(', ')} is generated and sealed — never shown in this plan,
            and revealable from the Operation afterwards.
          </Text>
        ) : null}
      </div>
    </li>
  );
}

/**
 * Read a repository's compose file and show what SlideOps would do with it.
 *
 * `onApprove` is where execution would begin. It is deliberately separate from
 * planning: the plan is safe to run as often as you like, and only approval acts.
 */
export function ComposeStackPlan({
  nodeID,
  repositoryURL,
  branch,
  name,
}: {
  nodeID: string;
  repositoryURL: string;
  branch?: string;
  name?: string;
}) {
  const [plan, setPlan] = useState<StackPlan | null>(null);
  const [planning, setPlanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setPlanning(true);
    setError(null);
    try {
      setPlan(await planComposeStack({ node_id: nodeID, repository_url: repositoryURL, branch, name }));
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : 'That repository could not be planned. Try again.',
      );
    } finally {
      setPlanning(false);
    }
  };

  const ready = Boolean(nodeID && repositoryURL);

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <ScanSearch width={18} height={18} className="text-brand" aria-hidden />
        <Text variant="h4">Plan this as Capabilities</Text>
      </div>

      <Text variant="body-sm" tone="secondary">
        Your compose file already says what you want. SlideOps can read it and install the databases
        and caches it names as managed Capabilities, create the database and account your app needs,
        and hand it the credentials — instead of you doing all three by hand. Nothing runs until you
        approve it.
      </Text>

      <div>
        <Button variant="secondary" onClick={run} disabled={!ready || planning}>
          {planning ? 'Reading the repository' : plan ? 'Plan again' : 'Show me the plan'}
          <ArrowRight width={15} height={15} aria-hidden />
        </Button>
        {!ready ? (
          <Text variant="caption" tone="secondary" className="mt-2 block">
            Choose a server and a repository first.
          </Text>
        ) : null}
      </div>

      {planning ? <Loading label="Reading the compose file" /> : null}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}

      {plan ? (
        <div className="flex flex-col gap-5">
          <Text variant="caption" tone="secondary">
            Read from <span className="font-mono">{plan.compose_file}</span>. Nothing below has run.
          </Text>

          {plan.steps.length > 0 ? (
            <ol className="flex flex-col">
              {plan.steps.map((step, index) => (
                <PlanStep key={`${step.kind}-${step.compose_service}-${index}`} step={step} index={index} />
              ))}
            </ol>
          ) : null}

          {plan.environment.length > 0 ? (
            <div>
              <Text variant="body-sm" className="mb-2 font-medium">
                Your application would receive
              </Text>
              <dl className="divide-y divide-border rounded-md border border-border">
                {plan.environment.map((entry) => (
                  <div key={entry.key} className="grid gap-1 px-3 py-2 sm:grid-cols-[14rem_1fr]">
                    <dt className="font-mono text-xs text-ink-muted">{entry.key}</dt>
                    <dd className="min-w-0 break-all font-mono text-xs text-ink">{entry.shape}</dd>
                  </div>
                ))}
              </dl>
              <Text variant="caption" tone="secondary" className="mt-2 block">
                Passwords are withheld here on purpose. Each is generated, sealed in the secret
                store, and revealable from the Operation that created it.
              </Text>
            </div>
          ) : null}

          {plan.warnings && plan.warnings.length > 0 ? (
            <div className="rounded-md border border-warning bg-subtle px-4 py-3">
              <div className="mb-2 flex items-center gap-2">
                <AlertTriangle width={16} height={16} className="text-warning" aria-hidden />
                <Text variant="body-sm" className="font-medium">
                  Read before approving
                </Text>
              </div>
              <ul className="flex list-disc flex-col gap-1.5 pl-5">
                {plan.warnings.map((warning) => (
                  <li key={warning}>
                    <Text variant="body-sm" tone="secondary">
                      {warning}
                    </Text>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <Text variant="caption" tone="secondary">
            Approving and running this plan is not built yet. For now, run the steps above as
            Capabilities from the server page, then deploy your application with the environment
            shown here — or use the Compose stack runtime to run the file exactly as written.
          </Text>
        </div>
      ) : null}
    </Card>
  );
}
