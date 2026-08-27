import { ApiError, getProject, removeProject } from '@slideops/api-client';
import { Button } from '@slideops/design-system';
import { ArrowLeft, Boxes, Globe, Layers, Server, Sparkles, Trash2 } from '@slideops/icons';
import { PageHeader, TabNav, type TabNavTab } from '@slideops/ui';
import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useCanWrite } from '../../store/workspace';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ErrorNote, Loading } from '../components/Feedback';
import { OperatorShell } from '../components/OperatorShell';
import { ProjectCapabilities } from '../components/ProjectCapabilities';
import { ProjectGitHub } from '../components/ProjectGitHub';
import { ProjectRouting } from '../components/ProjectRouting';
import { ProjectServers } from '../components/ProjectServers';
import { ProjectServices } from '../components/ProjectServices';
import { ProjectStack } from '../components/ProjectStack';
import { useAsyncData } from '../hooks/useAsyncData';

const PROJECT_TABS: TabNavTab[] = [
  { key: 'overview', label: 'Overview', icon: Server },
  { key: 'domains', label: 'Domains', icon: Globe },
  { key: 'stack', label: 'Stack', icon: Boxes },
  { key: 'capabilities', label: 'Capabilities', icon: Sparkles },
  { key: 'services', label: 'Services', icon: Layers },
];
const DEFAULT_PROJECT_TAB = 'overview';

/**
 * The Project view: the second level of the two-level model. A Project gathers
 * the servers it runs on, the stack of Plugins installed into it, the
 * Capabilities those Plugins unlock, the GitHub connection deploys pull from, and
 * the Services running here. Each section loads and handles its own state.
 */
export function ProjectDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const canWrite = useCanWrite();
  const { state } = useAsyncData((signal) => getProject(id, signal), [id]);
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = PROJECT_TABS.some((tab) => tab.key === searchParams.get('tab'))
    ? (searchParams.get('tab') as string)
    : DEFAULT_PROJECT_TAB;
  const setActiveTab = (key: string) => {
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (key === DEFAULT_PROJECT_TAB) {
          next.delete('tab');
        } else {
          next.set('tab', key);
        }
        return next;
      },
      { replace: true },
    );
  };

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const runDelete = async () => {
    setDeleteError(null);
    try {
      await removeProject(id);
      navigate('/app/projects');
    } catch (error) {
      setConfirmDelete(false);
      setDeleteError(
        error instanceof ApiError ? error.message : 'The Project could not be deleted. Try again.',
      );
    }
  };

  return (
    <OperatorShell active="projects">
      <Button variant="ghost" size="sm" className="mb-4" onClick={() => navigate('/app/projects')}>
        <ArrowLeft width={16} height={16} aria-hidden />
        All Projects
      </Button>

      {state.status === 'loading' ? <Loading label="Loading this Project" /> : null}
      {state.status === 'error' ? <ErrorNote error={state.error} /> : null}
      {state.status === 'ready' ? (
        <>
          <PageHeader
            title={state.data.name}
            description={
              state.data.description || 'A Project groups a stack on one or more of your servers.'
            }
            guidanceKey="project.overview"
            tabs={<TabNav tabs={PROJECT_TABS} active={activeTab} onSelect={setActiveTab} />}
            actions={
              canWrite ? (
                <Button variant="danger" onClick={() => setConfirmDelete(true)}>
                  <Trash2 width={16} height={16} aria-hidden />
                  Delete Project
                </Button>
              ) : undefined
            }
          />

          {deleteError ? (
            <p role="alert" className="mb-4 text-sm text-danger">
              {deleteError}
            </p>
          ) : null}

          {activeTab === 'overview' ? (
            <div className="grid gap-6 lg:grid-cols-2">
              <ProjectServers projectId={id} />
              <ProjectGitHub />
            </div>
          ) : null}

          {activeTab === 'domains' ? (
            <ProjectRouting projectId={id} domain={state.data.domain} />
          ) : null}

          {activeTab === 'stack' ? <ProjectStack projectId={id} /> : null}

          {activeTab === 'capabilities' ? <ProjectCapabilities projectId={id} /> : null}

          {activeTab === 'services' ? <ProjectServices projectId={id} /> : null}
        </>
      ) : null}

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this Project?"
        description={
          <>
            This removes{' '}
            <span className="font-medium text-ink">
              {state.status === 'ready' ? state.data.name : 'this Project'}
            </span>{' '}
            and its installed stack. The servers assigned to it return to the server level and stay
            connected and secured. Services in the Project are not removed here.
          </>
        }
        confirmLabel="Delete Project"
        confirmVariant="danger"
        onConfirm={runDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </OperatorShell>
  );
}
