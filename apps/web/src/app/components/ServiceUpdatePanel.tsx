import {
  ApiError,
  checkServiceUpdate,
  redeployService,
  type Service,
  type ServiceUpdate,
} from '@slideops/api-client';
import { Button, Card, Text, cn } from '@slideops/design-system';
import { CheckCircle2, GitBranch, Info, Rocket, ScanSearch } from '@slideops/icons';
import { useState } from 'react';
import { useCanWrite } from '../../store/workspace';
import { ErrorNote, Loading } from './Feedback';
import { useAsyncData } from '../hooks/useAsyncData';

/*
 * The deploy-latest surface. It shows the commit a Service is running, checks
 * whether its repository branch has moved ahead, and offers a single primary
 * action to redeploy to the latest commit. Discovery only observes here: the
 * update check never changes the Service. Every color is a semantic token, so
 * the panel reads correctly in both themes.
 */

/** How many characters of a full git SHA to show. Long enough to be unambiguous. */
const SHORT_SHA_LENGTH = 12;

/** Abbreviate a full git SHA for display, leaving a short value untouched. */
function shortSha(commit: string): string {
  return commit.slice(0, SHORT_SHA_LENGTH);
}

const badgeBase = 'inline-flex items-center gap-1.5 rounded-pill px-2.5 py-0.5 text-xs font-medium';

/** The commit the Service is running, or a calm note when none is pinned. */
function RunningCommit({ commit }: { commit: string }) {
  if (!commit) {
    return (
      <Text variant="body-sm" tone="secondary">
        Not deployed from a pinned commit yet.
      </Text>
    );
  }
  return (
    <code
      title={commit}
      className="inline-block max-w-full truncate rounded-md border border-border bg-subtle px-2 py-1 font-mono text-xs text-ink"
    >
      {shortSha(commit)}
    </code>
  );
}

interface UpdateResultProps {
  update: ServiceUpdate;
  deploying: boolean;
  onDeployLatest: () => void;
}

/** Render the outcome of an update check: available, up to date, or a reason. */
function UpdateResult({ update, deploying, onDeployLatest }: UpdateResultProps) {
  const canWrite = useCanWrite();
  if (update.update_available) {
    return (
      <div className="flex flex-col gap-3">
        <span className={cn(badgeBase, 'bg-subtle text-info')}>
          <Info width={12} height={12} aria-hidden />
          Update available
        </span>
        <Text variant="body-sm" tone="secondary">
          The <span className="font-mono">{update.branch}</span> branch has moved ahead to{' '}
          <span className="font-mono text-ink">{shortSha(update.latest_commit)}</span>.
        </Text>
        {canWrite ? (
          <Button onClick={onDeployLatest} disabled={deploying}>
            <Rocket width={15} height={15} aria-hidden />
            {deploying ? 'Deploying' : 'Deploy latest'}
          </Button>
        ) : (
          <Text variant="body-sm" tone="secondary">
            Deploying the latest commit needs a role above Viewer in this workspace.
          </Text>
        )}
      </div>
    );
  }

  // A normal false result is not an error. Show the returned reason when there is
  // one (for example an image source), otherwise a calm up-to-date confirmation.
  return update.reason ? (
    <div className="flex items-start gap-2">
      <Info width={16} height={16} className="mt-0.5 shrink-0 text-ink-muted" aria-hidden />
      <Text variant="body-sm" tone="secondary">
        {update.reason}
      </Text>
    </div>
  ) : (
    <div className="flex items-center gap-2">
      <span className={cn(badgeBase, 'bg-subtle text-success')}>
        <CheckCircle2 width={12} height={12} aria-hidden />
        Up to date
      </span>
    </div>
  );
}

export interface ServiceUpdatePanelProps {
  service: Service;
  /** Called after a redeploy starts, so the screen can refetch and reflect deploying. */
  onDeployed: () => void;
}

/**
 * The deployment card: running commit, update status, and the deploy-latest
 * action. The check runs on load and re-runs whenever the running commit or the
 * status settles, so it stays accurate after a redeploy without polling.
 */
export function ServiceUpdatePanel({ service, onDeployed }: ServiceUpdatePanelProps) {
  const { id, status } = service;
  const deployedCommit = service.deployed_commit ?? '';
  const isDeploying = status === 'deploying';
  // An adopted workload was already running when SlideOps found it, so there is
  // no repository behind it to check and nothing to rebuild it from. Saying so
  // plainly is better than an update check that can only ever fail.
  const isAdopted = service.adopted === true;

  const [redeployError, setRedeployError] = useState<string | null>(null);
  const [redeploying, setRedeploying] = useState(false);

  // Skip the check while the Service is deploying: the commit is in flux and the
  // deploying note carries the state. Skip it entirely for an adopted workload,
  // which has no repository to compare against. Re-key on the commit and status
  // so a settled redeploy re-checks against the new running commit.
  const { state, reload } = useAsyncData(
    (signal) =>
      isDeploying || isAdopted
        ? Promise.resolve<ServiceUpdate | null>(null)
        : checkServiceUpdate(id, signal),
    [id, deployedCommit, status, isAdopted],
  );

  const deployLatest = async () => {
    setRedeploying(true);
    setRedeployError(null);
    try {
      await redeployService(id);
      onDeployed();
    } catch (error) {
      setRedeployError(
        error instanceof ApiError ? error.message : 'The latest could not be deployed. Try again.',
      );
      setRedeploying(false);
    }
  };

  if (isAdopted) {
    return (
      <Card className="h-fit">
        <div className="flex items-center gap-2">
          <ScanSearch width={16} height={16} className="text-ink-muted" aria-hidden />
          <Text variant="h4">Deployment</Text>
        </div>
        <Text variant="body-sm" tone="secondary" className="mt-3">
          This was already running when SlideOps found it, so SlideOps has nothing to rebuild it
          from. You can start, stop, restart, and watch it here; to deploy a new version, do it the
          way you always have, or deploy it as a new Service from its repository.
        </Text>
      </Card>
    );
  }

  return (
    <Card className="h-fit">
      <div className="flex items-center gap-2">
        <GitBranch width={16} height={16} className="text-ink-muted" aria-hidden />
        <Text variant="h4">Deployment</Text>
      </div>

      <dl className="mt-3 flex flex-col gap-1.5">
        <dt className="text-xs font-medium text-ink-muted">Running commit</dt>
        <dd className="min-w-0">
          <RunningCommit commit={deployedCommit} />
        </dd>
      </dl>

      <div className="mt-4">
        {isDeploying ? (
          <div role="status" className="flex items-center gap-2">
            <span className={cn(badgeBase, 'bg-subtle text-info')}>Deploying</span>
            <Text variant="body-sm" tone="secondary">
              Pulling the latest, rebuilding, and verifying.
            </Text>
          </div>
        ) : state.status === 'loading' ? (
          <Loading label="Checking for updates" />
        ) : state.status === 'error' ? (
          <div className="flex flex-col gap-3">
            <ErrorNote error={state.error} />
            <div>
              <Button variant="secondary" size="sm" onClick={reload}>
                Try again
              </Button>
            </div>
          </div>
        ) : state.data ? (
          <UpdateResult update={state.data} deploying={redeploying} onDeployLatest={deployLatest} />
        ) : null}
      </div>

      {redeployError ? (
        <p role="alert" className="mt-3 text-sm text-danger">
          {redeployError}
        </p>
      ) : null}
    </Card>
  );
}
