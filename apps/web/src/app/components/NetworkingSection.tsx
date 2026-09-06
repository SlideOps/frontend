import { getDatabaseAccessRules, type ApiError, type DatabaseAccessRule } from '@slideops/api-client';
import { Button, Text } from '@slideops/design-system';
import { ShieldCheck } from '@slideops/icons';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ErrorNote, Loading } from './Feedback';

/*
 * What is currently allowed to reach this database.
 *
 * A database installed on one Node and an application on another can both
 * report healthy while the connection between them simply does not work,
 * because nothing had opened the firewall or the database's own access
 * control between them. This is the read side of that gap: every rule
 * SlideOps' configure-database-access Capability has put in place for this
 * database, read from SlideOps' own record rather than derived live over
 * SSH, so it still answers when the Node is briefly unreachable.
 *
 * "Configure Access" links to configure-database-access's own Capability
 * page with this Node preselected -- the same Plan, Approve, Execute flow
 * every other Capability already uses, rather than a second launch form
 * duplicated here.
 */

export function NetworkingSection({ capabilityKey, nodeId }: { capabilityKey: string; nodeId: string }) {
  const navigate = useNavigate();
  const [rules, setRules] = useState<DatabaseAccessRule[] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const result = await getDatabaseAccessRules(nodeId, capabilityKey, signal);
        if (!signal?.aborted) {
          setRules(result);
        }
      } catch (caught) {
        if (!signal?.aborted) {
          setError(caught as ApiError);
        }
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [capabilityKey, nodeId],
  );

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <Text variant="body-sm" tone="secondary">
          Every source currently allowed to reach this database, on the firewall and in the
          database's own access control together.
        </Text>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => navigate(`/app/capabilities/configure-database-access?node=${encodeURIComponent(nodeId)}`)}
        >
          Configure access
        </Button>
      </div>

      {loading ? <Loading label="Reading access rules" /> : null}
      {error ? <ErrorNote error={error} /> : null}

      {!loading && !error && rules && rules.length === 0 ? (
        <div className="flex items-center gap-3 rounded-md border border-dashed border-border bg-subtle px-4 py-6">
          <ShieldCheck width={18} height={18} className="text-ink-muted" aria-hidden />
          <Text variant="body-sm" tone="secondary">
            No access rules yet. If this database is only reached from the same Node, none are
            needed. Reaching it from another Node needs one.
          </Text>
        </div>
      ) : null}

      {!loading && !error && rules && rules.length > 0 ? (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-subtle text-xs uppercase tracking-wide text-ink-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Source</th>
                <th className="px-3 py-2 font-medium">Port</th>
                <th className="px-3 py-2 font-medium">Topology</th>
                <th className="px-3 py-2 font-medium">State</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rules.map((rule) => (
                <tr key={rule.id}>
                  <td className="px-3 py-2 font-mono text-xs">{rule.source_cidr}</td>
                  <td className="px-3 py-2">
                    {rule.to_port}/{rule.protocol}
                  </td>
                  <td className="px-3 py-2">
                    {rule.topology === 'cross_node' ? 'Cross-Node' : 'Same-Node'}
                  </td>
                  <td className="px-3 py-2 capitalize">{rule.state}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
