import { getCapabilityStates, listOperations, type Operation } from '@slideops/api-client';
import { Button, Card, Text } from '@slideops/design-system';
import { ArrowRight, Cpu } from '@slideops/icons';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

/*
 * The one nudge deployment-lifecycle auto-detection actually needs: Redis is
 * configured on this Service's own Node, and this Service has never had a
 * Celery worker configured against it. That is exactly the gap the
 * production incident this whole feature traces back to fell into --
 * nothing in SlideOps ever asked whether an application that can reach
 * Redis also has a worker.
 *
 * This never configures anything on its own. It is a calm callout pointing
 * at Celery's own page, the same reasoning CreateDatabaseCredentials already
 * uses for "install a database, then get nudged toward creating one" on the
 * Capability pages -- and it disappears the moment a worker exists,
 * dismissed or not, since there is nothing left to nudge toward.
 */

export interface CeleryDeployNudgeProps {
  nodeId: string;
  serviceId: string;
}

export function CeleryDeployNudge({ nodeId, serviceId }: CeleryDeployNudgeProps) {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([
      getCapabilityStates(nodeId),
      listOperations({ node_id: nodeId, status: 'completed' }),
    ])
      .then(([states, operations]: [Record<string, unknown>, Operation[]]) => {
        if (!active) {
          return;
        }
        const redisConfigured = Boolean(states['configure-redis']);
        const alreadyConfigured = operations.some((op) => op.capability_key === 'configure-celery-worker');
        setVisible(redisConfigured && !alreadyConfigured);
      })
      .catch(() => {
        // A nudge that fails to load is simply absent; it is not worth
        // showing an error for a callout that offers nothing essential.
      });
    return () => {
      active = false;
    };
  }, [nodeId]);

  if (!visible || dismissed) {
    return null;
  }

  return (
    <Card className="flex flex-col gap-3 border-brand">
      <div className="flex items-center gap-2">
        <Cpu width={18} height={18} className="text-brand" aria-hidden />
        <Text variant="h4">Does this application use Celery?</Text>
      </div>
      <Text variant="body-sm" tone="secondary">
        Redis is configured on this server. If this application enqueues background jobs through it,
        it needs a supervised Celery worker to actually run them -- Redis being healthy says nothing
        about whether one exists.
      </Text>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={() => navigate(`/app/capabilities/configure-celery-worker?node=${nodeId}&service=${serviceId}`)}
        >
          Configure a Celery worker
          <ArrowRight width={15} height={15} aria-hidden />
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setDismissed(true)}>
          Not this application
        </Button>
      </div>
    </Card>
  );
}
