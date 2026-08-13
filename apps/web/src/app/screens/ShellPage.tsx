import {
  getNode,
  getService,
  nodeShellUrl,
  serviceShellUrl,
  type ApiError,
} from '@slideops/api-client';
import { Text } from '@slideops/design-system';
import { ArrowLeft } from '@slideops/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { ShellTabs } from '../components/shell/ShellTabs';
import { ErrorNote, Loading } from '../components/Feedback';
import { useAsyncData } from '../hooks/useAsyncData';

/*
 * A shell on a page of its own.
 *
 * Filling the window is enough for most work, but not for the case people
 * actually ask about: a terminal on one monitor while the thing you are
 * following sits on the other. That needs a real second window, which an
 * expanded panel inside one tab cannot be.
 *
 * So the same terminal is reachable at its own route. There is no application
 * navigation on it, deliberately: this page is one terminal and nothing else,
 * which is what somebody who opened a window for a terminal wanted.
 */

/** The shell for one Node, on its own page. */
export function NodeShellPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { state } = useAsyncData((signal) => getNode(id, signal), [id]);
  const name = state.status === 'ready' ? state.data.name : '';

  return (
    <StandaloneShell
      title={name ? `Shell on ${name}` : 'Shell'}
      loading={state.status === 'loading'}
      error={state.status === 'error' ? state.error : null}
      onBack={() => navigate(`/app/nodes/${id}`)}
      backLabel="Back to this server"
    >
      <ShellTabs
        urlFor={(cols, rows) => nodeShellUrl(id, cols, rows)}
        scopeLabel="This server"
        scopeDetail="A shell on the server itself. Opening it is recorded in the audit trail."
      />
    </StandaloneShell>
  );
}

/** The shell for one Service, on its own page. */
export function ServiceShellPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { state } = useAsyncData((signal) => getService(id, signal), [id]);
  const service = state.status === 'ready' ? state.data : null;

  return (
    <StandaloneShell
      title={service ? `Shell in ${service.name}` : 'Shell'}
      loading={state.status === 'loading'}
      error={state.status === 'error' ? state.error : null}
      onBack={() => navigate(`/app/services/${id}`)}
      backLabel="Back to this Service"
    >
      <ShellTabs
        urlFor={(cols, rows) => serviceShellUrl(id, cols, rows)}
        scopeLabel={service?.runtime === 'systemd' ? 'This Service, on the server' : 'Inside this Service'}
        scopeDetail={
          service?.runtime === 'systemd'
            ? 'A shell on the server in this Service’s own directory. Opening it is recorded in the audit trail.'
            : 'A shell inside this Service’s own container. Opening it is recorded in the audit trail.'
        }
        unavailableReason={
          !service || service.status === 'running'
            ? undefined
            : `This Service is ${service.status}, so there is nothing running to open a shell in.`
        }
      />
    </StandaloneShell>
  );
}

/** The frame both standalone shells share: a title, a way back, and the terminal. */
function StandaloneShell({
  title,
  loading,
  error,
  onBack,
  backLabel,
  children,
}: {
  title: string;
  loading: boolean;
  error: ApiError | null;
  onBack: () => void;
  backLabel: string;
  children: React.ReactNode;
}) {
  return (
    // The whole viewport, so the terminal inside it has the room this page exists
    // to give it.
    <div className="flex h-dvh flex-col gap-3 bg-app p-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 text-sm text-ink-muted transition-colors duration-fast ease-standard hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          <ArrowLeft width={16} height={16} aria-hidden />
          {backLabel}
        </button>
        <Text variant="h4">{title}</Text>
      </div>

      {loading ? <Loading label="Opening" /> : null}
      {error ? <ErrorNote error={error} /> : null}
      {/* min-h-0 so the terminal can shrink inside the flex column rather than
          pushing the page into a scroll. */}
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
