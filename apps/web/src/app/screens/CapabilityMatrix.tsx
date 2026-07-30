import { getMatrix, type CapabilityMatrix as Matrix } from '@slideops/api-client';
import { ArrowLeft, Check, Layers, Minus } from '@slideops/icons';
import { Guidance } from '@slideops/tooltips';
import { EmptyState, PageHeader } from '@slideops/ui';
import { useNavigate } from 'react-router-dom';
import { ErrorNote, Loading } from '../components/Feedback';
import { OperatorShell } from '../components/OperatorShell';
import { useAsyncData } from '../hooks/useAsyncData';

/** Friendly names for the platform ids the matrix reports. */
const PLATFORM_LABEL: Record<string, string> = {
  debian: 'Debian',
  ubuntu: 'Ubuntu',
  fedora: 'Fedora',
  rhel: 'RHEL',
  rocky: 'Rocky',
  alma: 'AlmaLinux',
  arch: 'Arch',
  alpine: 'Alpine',
  opensuse: 'openSUSE',
};

function platformLabel(id: string): string {
  return PLATFORM_LABEL[id] ?? id.charAt(0).toUpperCase() + id.slice(1);
}

/** One supported or not-supported cell, announced for assistive technology. */
function SupportCell({ supported, platform }: { supported: boolean; platform: string }) {
  return (
    <td className="border-b border-border px-3 py-2 text-center">
      {supported ? (
        <span className="inline-flex text-success" title={`Supported on ${platform}`}>
          <Check width={16} height={16} aria-hidden />
          <span className="sr-only">Supported on {platform}</span>
        </span>
      ) : (
        <span className="inline-flex text-ink-muted" title={`Not supported on ${platform}`}>
          <Minus width={16} height={16} aria-hidden />
          <span className="sr-only">Not supported on {platform}</span>
        </span>
      )}
    </td>
  );
}

/**
 * The capability matrix: Capabilities as rows, platforms as columns, and a clear
 * supported or not cell at each intersection. The table scrolls horizontally on
 * small screens and keeps the Capability column in view. It is generated from the
 * Provider registry, so it stays correct as Providers change.
 */
export function CapabilityMatrix() {
  const navigate = useNavigate();
  const { state } = useAsyncData<Matrix>((signal) => getMatrix(signal), []);

  return (
    <OperatorShell active="capabilities">
      <button
        type="button"
        onClick={() => navigate('/app/capabilities')}
        className="mb-4 inline-flex items-center gap-1 text-sm text-ink-muted transition-colors duration-fast ease-standard hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        <ArrowLeft width={16} height={16} aria-hidden />
        All Capabilities
      </button>

      <PageHeader
        title="Capability matrix"
        description="Which Capabilities apply to which Linux platforms. This is generated from the Providers behind each Capability, so it always reflects what will actually run."
      />

      {state.status === 'loading' ? <Loading label="Building the matrix" /> : null}
      {state.status === 'error' ? <ErrorNote error={state.error} /> : null}
      {state.status === 'ready' ? (
        state.data.capabilities.length === 0 || state.data.platforms.length === 0 ? (
          <EmptyState
            icon={Layers}
            title="No matrix to show yet"
            description="Once Capabilities and platforms are registered, this matrix shows where each one applies."
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">
                Capabilities by platform. A check means the Capability is supported on that
                platform.
              </caption>
              <thead>
                <tr className="bg-subtle">
                  <th
                    scope="col"
                    className="sticky left-0 z-10 border-b border-border bg-subtle px-4 py-3 text-left font-semibold text-ink"
                  >
                    <span className="inline-flex items-center gap-2">
                      Capability
                      <Guidance for="capability.matrix" size={14} />
                    </span>
                  </th>
                  {state.data.platforms.map((platform) => (
                    <th
                      scope="col"
                      key={platform}
                      className="border-b border-border px-3 py-3 text-center font-semibold text-ink"
                    >
                      {platformLabel(platform)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {state.data.capabilities.map((row) => (
                  <tr
                    key={row.key}
                    className="transition-colors duration-fast ease-standard hover:bg-subtle"
                  >
                    <th
                      scope="row"
                      className="sticky left-0 z-10 border-b border-border bg-surface px-4 py-2 text-left font-medium text-ink"
                    >
                      <button
                        type="button"
                        onClick={() => navigate(`/app/capabilities/${row.key}`)}
                        className="text-left hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                      >
                        {row.name}
                      </button>
                    </th>
                    {state.data.platforms.map((platform) => (
                      <SupportCell
                        key={platform}
                        platform={platformLabel(platform)}
                        supported={row.support[platform] === true}
                      />
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : null}
    </OperatorShell>
  );
}
