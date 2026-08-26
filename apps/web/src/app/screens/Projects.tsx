import { zodResolver } from '@hookform/resolvers/zod';
import { ApiError, createProject, listProjects, type Project } from '@slideops/api-client';
import { Button, Card, Field, Text } from '@slideops/design-system';
import { ChevronRight, FolderKanban, Plus, X } from '@slideops/icons';
import { Guidance } from '@slideops/tooltips';
import { EmptyState, PageHeader } from '@slideops/ui';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useCanWrite } from '../../store/workspace';
import { ErrorNote, Loading } from '../components/Feedback';
import { OperatorShell } from '../components/OperatorShell';
import { useAsyncData } from '../hooks/useAsyncData';

const schema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Give this Project a name.')
    .max(80, 'Keep the name under 80 characters.'),
  description: z.string().trim().max(500, 'Keep the description under 500 characters.').optional(),
});

type FormValues = z.infer<typeof schema>;

const inputClass =
  'w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted transition-colors duration-fast ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus';

function ProjectRow({ project, onOpen }: { project: Project; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-4 rounded-md border border-border bg-surface px-4 py-3 text-left transition-colors duration-fast ease-standard hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
    >
      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-subtle text-brand">
        <FolderKanban width={18} height={18} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <Text variant="body-sm" className="font-medium">
          {project.name}
        </Text>
        <Text variant="body-sm" tone="secondary" className="truncate">
          {project.description || 'No description'}
        </Text>
      </span>
      <ChevronRight width={18} height={18} className="shrink-0 text-ink-muted" aria-hidden />
    </button>
  );
}

/** The inline create form, shown when the Operator chooses to add a Project. */
function CreateProjectForm({
  onCreated,
  onCancel,
}: {
  onCreated: () => void;
  onCancel: () => void;
}) {
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);
  const [quotaHit, setQuotaHit] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', description: '' },
  });

  const submit = handleSubmit(async (values) => {
    setFormError(null);
    setQuotaHit(false);
    try {
      const project = await createProject({
        name: values.name,
        description: values.description || undefined,
      });
      onCreated();
      navigate(`/app/projects/${project.id}`);
    } catch (error) {
      if (error instanceof ApiError && error.code === 'quota_exceeded') {
        setQuotaHit(true);
        setFormError(error.message);
        return;
      }
      setFormError(
        error instanceof ApiError ? error.message : 'The Project could not be created. Try again.',
      );
    }
  });

  return (
    <Card className="mb-8 max-w-2xl">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FolderKanban width={18} height={18} className="text-brand" aria-hidden />
          <Text variant="h4">Create a Project</Text>
          <Guidance for="project.create" />
        </div>
        <Button variant="ghost" size="sm" aria-label="Close" onClick={onCancel}>
          <X width={16} height={16} aria-hidden />
        </Button>
      </div>

      <form className="flex flex-col gap-5" onSubmit={submit} noValidate>
        <Field
          label="Name"
          placeholder="online shop"
          error={errors.name?.message}
          labelAdornment={<Guidance for="project.name" />}
          {...register('name')}
        />

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="project-description" className="text-sm font-medium text-ink">
              Description (optional)
            </label>
            <Guidance for="project.description" />
          </div>
          <textarea
            id="project-description"
            rows={3}
            spellCheck
            placeholder="What this Project runs and why it exists."
            className={`resize-y ${inputClass} ${errors.description ? 'border-danger' : ''}`}
            {...register('description')}
          />
          {errors.description ? (
            <p className="text-sm text-danger">{errors.description.message}</p>
          ) : null}
        </div>

        {formError ? (
          <div role="alert" className="rounded-md border border-border bg-subtle px-4 py-3">
            <Text variant="body-sm" className="font-medium text-danger">
              {quotaHit ? 'Over your tier quota' : 'That did not go through'}
            </Text>
            <Text variant="body-sm" tone="secondary" className="mt-0.5">
              {formError}
            </Text>
            {quotaHit ? (
              <Text variant="body-sm" tone="secondary" className="mt-1">
                Remove a Project to free room, or ask an admin to raise your tier.
              </Text>
            ) : null}
          </div>
        ) : null}

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Creating' : 'Create Project'}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}

/** The Projects list: the second level of the model, each Project a stack on one or more servers. */
export function Projects() {
  const navigate = useNavigate();
  const canWrite = useCanWrite();
  const [creating, setCreating] = useState(false);
  const { state, reload } = useAsyncData((signal) => listProjects(signal), []);

  const onCreated = () => {
    setCreating(false);
    reload();
  };

  return (
    <OperatorShell active="projects">
      <PageHeader
        title="Projects"
        description="A Project groups a stack on one or more of your servers. Assign the servers it runs on, install the Plugins it needs, connect a repository, and deploy its Services."
        guidanceKey="dashboard.projects"
        actions={
          canWrite ? (
            <Button onClick={() => setCreating((open) => !open)}>
              <Plus width={16} height={16} aria-hidden />
              Create a Project
            </Button>
          ) : undefined
        }
      />

      {creating ? (
        <CreateProjectForm onCreated={onCreated} onCancel={() => setCreating(false)} />
      ) : null}

      {state.status === 'loading' ? <Loading label="Loading your Projects" /> : null}
      {state.status === 'error' ? <ErrorNote error={state.error} /> : null}
      {state.status === 'ready' ? (
        state.data.length === 0 ? (
          <EmptyState
            icon={FolderKanban}
            title="No Projects yet"
            description="A Project groups a stack on one or more of your servers. Create one, assign the servers it runs on, and install only the Plugins it needs."
            action={canWrite ? <Button onClick={() => setCreating(true)}>Create your first Project</Button> : undefined}
          />
        ) : (
          <div className="flex flex-col gap-2">
            {state.data.map((project) => (
              <ProjectRow
                key={project.id}
                project={project}
                onOpen={() => navigate(`/app/projects/${project.id}`)}
              />
            ))}
          </div>
        )
      ) : null}
    </OperatorShell>
  );
}
