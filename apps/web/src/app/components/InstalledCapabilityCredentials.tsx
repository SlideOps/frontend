import { getOperation, type Operation } from '@slideops/api-client';
import { Card, Text } from '@slideops/design-system';
import { KeyRound } from '@slideops/icons';
import { CredentialsCard } from './CredentialsCard';
import { ErrorNote, Loading } from './Feedback';
import { useAsyncData } from '../hooks/useAsyncData';

/**
 * One installed app's configuration and credentials, on a Service's Settings
 * tab: the same CredentialsCard CapabilityDetail already shows for a
 * Capability run from its own page, reached here from the Operation that
 * installed or configured it. The caller decides whether to render this at
 * all (only once a Capability actually has a last_operation_id to read from),
 * so this component can assume operationId is real rather than guarding an
 * empty one itself.
 */
export function InstalledCapabilityCredentials({
  pluginName,
  operationId,
  host,
  dockerBridgeAddress,
}: {
  pluginName: string;
  operationId: string;
  host?: string;
  dockerBridgeAddress?: string;
}) {
  const result = useAsyncData<Operation>((signal) => getOperation(operationId, signal), [operationId]);

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <KeyRound width={16} height={16} className="text-brand" aria-hidden />
        <Text variant="h4">{pluginName}</Text>
      </div>
      {result.state.status === 'loading' ? <Loading label={`Reading ${pluginName}'s configuration`} /> : null}
      {result.state.status === 'error' ? <ErrorNote error={result.state.error} /> : null}
      {result.state.status === 'ready' ? (
        <CredentialsCard
          operation={result.state.data}
          host={host}
          dockerBridgeAddress={dockerBridgeAddress}
        />
      ) : null}
    </Card>
  );
}
