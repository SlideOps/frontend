import {
  ApiError,
  createDockerContainer,
  refusalExplanation,
  type DockerCreatedContainer,
  type DockerRunRequest,
} from '@slideops/api-client';
import { Button, Field, Text } from '@slideops/design-system';
import { AlertTriangle, ChevronDown, ChevronRight, Eye, EyeOff, Plus, X } from '@slideops/icons';
import { useState } from 'react';
import { useCanWrite } from '../../store/workspace';

/*
 * Running one container by hand.
 *
 * Two rules shape this form more than anything about its layout.
 *
 * The first is what it does not offer. There is no privileged toggle, no
 * capability list, and no shortcut for mounting the Docker socket. A container
 * with any of those is root on the server with extra steps, and a form that
 * offers it is a form that will eventually be used to do it by somebody who
 * read on a forum that it fixes their problem. The backend refuses these too;
 * that is defence in depth, not a reason to offer them here.
 *
 * The second is that environment values are secrets. They are masked on screen
 * by default, they are never put in a URL, and nothing here writes one to a
 * log. An Operator can reveal one they are typing, per row, because a password
 * typed blind is a password typed wrong.
 *
 * Progressive disclosure does the rest: image, name, ports, environment,
 * volumes and restart policy are what almost every container needs, and the
 * other nine fields are behind a control that says what is in there.
 */

/** What Docker will do with the container when it stops or the Node reboots. */
const RESTART_POLICIES: { value: string; label: string }[] = [
  { value: '', label: 'No restart policy' },
  { value: 'on-failure', label: 'Restart if it exits with an error' },
  { value: 'unless-stopped', label: 'Always restart, unless stopped by hand' },
  { value: 'always', label: 'Always restart' },
];

/**
 * The mount SlideOps will not help anybody make.
 *
 * Handing a container the Docker socket gives it the ability to start any other
 * container, on any image, with any mount, as root. It is not a hardening
 * question, it is the whole boundary. The backend refuses it as well; this
 * check exists so an Operator finds out while they are typing rather than after
 * a request that reads like a fault.
 */
const DOCKER_SOCKET_PATHS = ['/var/run/docker.sock', '/run/docker.sock'];

function isDockerSocket(source: string): boolean {
  const trimmed = source.trim();
  return DOCKER_SOCKET_PATHS.some((path) => trimmed === path || trimmed.startsWith(`${path}:`));
}

interface PortRow {
  hostPort: string;
  containerPort: string;
  protocol: string;
}

interface EnvRow {
  key: string;
  value: string;
}

interface VolumeRow {
  source: string;
  destination: string;
  readOnly: boolean;
}

interface LabelRow {
  key: string;
  value: string;
}

const inputClass =
  'h-9 w-full rounded-md border border-border bg-surface px-2.5 text-sm text-ink transition-colors duration-fast ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus';

export function DockerRunForm({
  nodeId,
  initial,
  notCopied,
  onCreated,
}: {
  nodeId: string;
  /** Prefill, as a clone does. Configuration only; never runtime state. */
  initial?: DockerRunRequest;
  /**
   * What a clone deliberately left out, shown above the form.
   *
   * A prefilled form that quietly dropped the volumes looks like the original
   * and starts with an empty database. Saying what is missing is the difference
   * between a copy and a surprise.
   */
  notCopied?: string[];
  onCreated?: (container: DockerCreatedContainer) => void;
}) {
  const canWrite = useCanWrite();

  const [image, setImage] = useState(initial?.image ?? '');
  const [name, setName] = useState(initial?.name ?? '');
  const [restartPolicy, setRestartPolicy] = useState(initial?.restart_policy ?? '');
  const [ports, setPorts] = useState<PortRow[]>(
    (initial?.ports ?? []).map((port) => ({
      hostPort: port.host_port === undefined ? '' : String(port.host_port),
      containerPort: String(port.container_port),
      protocol: port.protocol || 'tcp',
    })),
  );
  const [env, setEnv] = useState<EnvRow[]>(
    Object.entries(initial?.env ?? {}).map(([key, value]) => ({ key, value })),
  );
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [volumes, setVolumes] = useState<VolumeRow[]>(
    (initial?.volumes ?? []).map((volume) => ({
      source: volume.source,
      destination: volume.destination,
      readOnly: volume.read_only === true,
    })),
  );

  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [command, setCommand] = useState(initial?.command ?? '');
  const [entrypoint, setEntrypoint] = useState(initial?.entrypoint ?? '');
  const [workingDir, setWorkingDir] = useState(initial?.working_dir ?? '');
  const [user, setUser] = useState(initial?.user ?? '');
  const [cpu, setCpu] = useState(initial?.cpu_limit_cores ? String(initial.cpu_limit_cores) : '');
  const [memory, setMemory] = useState(
    initial?.memory_limit_mb ? String(initial.memory_limit_mb) : '',
  );
  const [network, setNetwork] = useState(initial?.network ?? '');
  const [dns, setDns] = useState((initial?.dns ?? []).join(', '));
  const [labels, setLabels] = useState<LabelRow[]>(
    Object.entries(initial?.labels ?? {}).map(([key, value]) => ({ key, value })),
  );
  const [healthCommand, setHealthCommand] = useState(
    initial?.healthcheck ? (initial.healthcheck.test ?? []).slice(1).join(' ') : '',
  );
  const [healthInterval, setHealthInterval] = useState(
    initial?.healthcheck?.interval_seconds ? String(initial.healthcheck.interval_seconds) : '',
  );
  const [healthRetries, setHealthRetries] = useState(
    initial?.healthcheck?.retries ? String(initial.healthcheck.retries) : '',
  );

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);

  const socketRow = volumes.findIndex((volume) => isDockerSocket(volume.source));
  const canSubmit = canWrite && image.trim() !== '' && socketRow === -1 && !submitting;

  const buildRequest = (): DockerRunRequest => {
    const request: DockerRunRequest = { image: image.trim() };
    if (name.trim()) {
      request.name = name.trim();
    }
    const portRows = ports
      .filter((port) => port.containerPort.trim() !== '')
      .map((port) => ({
        container_port: Number(port.containerPort),
        protocol: port.protocol || 'tcp',
        host_port: port.hostPort.trim() === '' ? undefined : Number(port.hostPort),
      }));
    if (portRows.length > 0) {
      request.ports = portRows;
    }
    const envEntries = env.filter((row) => row.key.trim() !== '');
    if (envEntries.length > 0) {
      request.env = Object.fromEntries(envEntries.map((row) => [row.key.trim(), row.value]));
    }
    const volumeRows = volumes
      .filter((volume) => volume.source.trim() !== '' && volume.destination.trim() !== '')
      .map((volume) => ({
        source: volume.source.trim(),
        destination: volume.destination.trim(),
        read_only: volume.readOnly,
      }));
    if (volumeRows.length > 0) {
      request.volumes = volumeRows;
    }
    if (restartPolicy) {
      request.restart_policy = restartPolicy;
    }
    if (command.trim()) {
      request.command = command.trim();
    }
    if (entrypoint.trim()) {
      request.entrypoint = entrypoint.trim();
    }
    if (workingDir.trim()) {
      request.working_dir = workingDir.trim();
    }
    if (user.trim()) {
      request.user = user.trim();
    }
    if (cpu.trim() && Number.isFinite(Number(cpu))) {
      request.cpu_limit_cores = Number(cpu);
    }
    if (memory.trim() && Number.isFinite(Number(memory))) {
      request.memory_limit_mb = Number(memory);
    }
    if (network.trim()) {
      request.network = network.trim();
    }
    const dnsServers = dns
      .split(',')
      .map((server) => server.trim())
      .filter(Boolean);
    if (dnsServers.length > 0) {
      request.dns = dnsServers;
    }
    const labelEntries = labels.filter((row) => row.key.trim() !== '');
    if (labelEntries.length > 0) {
      request.labels = Object.fromEntries(labelEntries.map((row) => [row.key.trim(), row.value]));
    }
    if (healthCommand.trim()) {
      request.healthcheck = {
        // CMD-SHELL is what an Operator typing one line means: run this through
        // a shell inside the container.
        test: ['CMD-SHELL', healthCommand.trim()],
        interval_seconds: healthInterval.trim() ? Number(healthInterval) : undefined,
        retries: healthRetries.trim() ? Number(healthRetries) : undefined,
      };
    }
    return request;
  };

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    setCreated(null);
    try {
      const container = await createDockerContainer(nodeId, buildRequest());
      // The endpoint reports the name it gave the container, and leaves it out
      // when the runtime named it. The short id identifies it either way.
      setCreated(container.name ?? container.id);
      onCreated?.(container);
    } catch (caught) {
      // A refusal is the product working, not a fault, so it is explained in
      // the same words the Operator would use rather than shown as a code.
      const refusal = refusalExplanation(caught);
      setError(
        refusal ??
          (caught instanceof ApiError
            ? caught.message
            : 'That container could not be created. Try again.'),
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!canWrite) {
    return (
      <Text variant="body-sm" tone="secondary">
        Your role in this Workspace is read only, so containers cannot be created from here.
      </Text>
    );
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (canSubmit) {
          void submit();
        }
      }}
    >
      {notCopied && notCopied.length > 0 ? (
        <div className="rounded-md border border-border bg-subtle px-4 py-3">
          <Text variant="body-sm" className="font-medium">
            What was not copied
          </Text>
          <ul className="mt-1 flex list-disc flex-col gap-0.5 pl-5">
            {notCopied.map((entry) => (
              <li key={entry}>
                <Text variant="caption" tone="secondary">
                  {entry}
                </Text>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <Field
        label="Image"
        placeholder="nginx:1.27"
        value={image}
        onChange={(event) => setImage(event.target.value)}
        hint="The image to run, with its tag. An untagged image gets whatever latest points at today."
        required
      />
      <Field
        label="Name"
        placeholder="Leave empty and Docker picks one"
        value={name}
        onChange={(event) => setName(event.target.value)}
        hint="Has to be unique on this server."
      />

      <RowEditor
        legend="Ports"
        description="Publish a container port to this server. Leave the server port empty to leave it reachable only inside Docker."
        rows={ports}
        onAdd={() => setPorts([...ports, { hostPort: '', containerPort: '', protocol: 'tcp' }])}
        onRemove={(index) => setPorts(ports.filter((_, at) => at !== index))}
        addLabel="Add a port"
        renderRow={(row, index) => (
          <>
            <input
              className={inputClass}
              aria-label={`Server port ${index + 1}`}
              placeholder="8080"
              inputMode="numeric"
              value={row.hostPort}
              onChange={(event) =>
                setPorts(
                  ports.map((port, at) =>
                    at === index ? { ...port, hostPort: event.target.value } : port,
                  ),
                )
              }
            />
            <input
              className={inputClass}
              aria-label={`Container port ${index + 1}`}
              placeholder="80"
              inputMode="numeric"
              value={row.containerPort}
              onChange={(event) =>
                setPorts(
                  ports.map((port, at) =>
                    at === index ? { ...port, containerPort: event.target.value } : port,
                  ),
                )
              }
            />
            <select
              className={inputClass}
              aria-label={`Protocol ${index + 1}`}
              value={row.protocol}
              onChange={(event) =>
                setPorts(
                  ports.map((port, at) =>
                    at === index ? { ...port, protocol: event.target.value } : port,
                  ),
                )
              }
            >
              <option value="tcp">TCP</option>
              <option value="udp">UDP</option>
            </select>
          </>
        )}
      />

      <RowEditor
        legend="Environment"
        description="Values are hidden as you type, because this is where passwords and API keys go. They are sent in the request body and never in a web address."
        rows={env}
        onAdd={() => setEnv([...env, { key: '', value: '' }])}
        onRemove={(index) => {
          setEnv(env.filter((_, at) => at !== index));
          setRevealed(new Set());
        }}
        addLabel="Add a variable"
        renderRow={(row, index) => (
          <>
            <input
              className={inputClass}
              aria-label={`Variable name ${index + 1}`}
              placeholder="POSTGRES_PASSWORD"
              value={row.key}
              onChange={(event) =>
                setEnv(
                  env.map((entry, at) =>
                    at === index ? { ...entry, key: event.target.value } : entry,
                  ),
                )
              }
            />
            <input
              className={inputClass}
              aria-label={`Value for variable ${index + 1}`}
              type={revealed.has(index) ? 'text' : 'password'}
              autoComplete="off"
              value={row.value}
              onChange={(event) =>
                setEnv(
                  env.map((entry, at) =>
                    at === index ? { ...entry, value: event.target.value } : entry,
                  ),
                )
              }
            />
            <Button
              type="button"
              size="sm"
              variant="ghost"
              aria-label={
                revealed.has(index) ? `Hide value ${index + 1}` : `Show value ${index + 1}`
              }
              onClick={() =>
                setRevealed((current) => {
                  const next = new Set(current);
                  if (next.has(index)) {
                    next.delete(index);
                  } else {
                    next.add(index);
                  }
                  return next;
                })
              }
            >
              {revealed.has(index) ? (
                <EyeOff width={14} height={14} aria-hidden />
              ) : (
                <Eye width={14} height={14} aria-hidden />
              )}
            </Button>
          </>
        )}
      />

      <RowEditor
        legend="Volumes"
        description="A named volume, or a path on this server, mounted inside the container."
        rows={volumes}
        onAdd={() => setVolumes([...volumes, { source: '', destination: '', readOnly: false }])}
        onRemove={(index) => setVolumes(volumes.filter((_, at) => at !== index))}
        addLabel="Add a volume"
        renderRow={(row, index) => (
          <>
            <input
              className={inputClass}
              aria-label={`Volume or path ${index + 1}`}
              placeholder="app_data"
              value={row.source}
              onChange={(event) =>
                setVolumes(
                  volumes.map((volume, at) =>
                    at === index ? { ...volume, source: event.target.value } : volume,
                  ),
                )
              }
            />
            <input
              className={inputClass}
              aria-label={`Mount path ${index + 1}`}
              placeholder="/var/lib/app"
              value={row.destination}
              onChange={(event) =>
                setVolumes(
                  volumes.map((volume, at) =>
                    at === index ? { ...volume, destination: event.target.value } : volume,
                  ),
                )
              }
            />
            <label className="flex items-center gap-1.5 whitespace-nowrap text-sm text-ink-muted">
              <input
                type="checkbox"
                checked={row.readOnly}
                onChange={(event) =>
                  setVolumes(
                    volumes.map((volume, at) =>
                      at === index ? { ...volume, readOnly: event.target.checked } : volume,
                    ),
                  )
                }
                className="h-3.5 w-3.5 rounded border-border text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              />
              Read only
            </label>
          </>
        )}
      />

      {socketRow !== -1 ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-md border border-danger bg-surface px-4 py-3"
        >
          <AlertTriangle
            width={18}
            height={18}
            className="mt-0.5 shrink-0 text-danger"
            aria-hidden
          />
          <div>
            <Text variant="body-sm" className="font-medium">
              SlideOps will not mount the Docker socket
            </Text>
            <Text variant="body-sm" tone="secondary" className="mt-0.5">
              A container holding the Docker socket can start any other container, as root, on this
              server. That is the whole boundary, so it is not something this form will do. Remove
              that mount to continue.
            </Text>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <label htmlFor="run-restart-policy" className="text-sm font-medium text-ink">
          Restart policy
        </label>
        <select
          id="run-restart-policy"
          className={`${inputClass} max-w-sm`}
          value={restartPolicy}
          onChange={(event) => setRestartPolicy(event.target.value)}
        >
          {RESTART_POLICIES.map((policy) => (
            <option key={policy.value} value={policy.value}>
              {policy.label}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-md border border-border">
        <button
          type="button"
          onClick={() => setAdvancedOpen(!advancedOpen)}
          aria-expanded={advancedOpen}
          className="flex w-full items-center gap-1.5 px-3 py-2.5 text-left text-sm font-medium text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          {advancedOpen ? (
            <ChevronDown width={14} height={14} aria-hidden />
          ) : (
            <ChevronRight width={14} height={14} aria-hidden />
          )}
          Advanced
          <span className="font-normal text-ink-muted">
            command, entrypoint, working directory, user, CPU, memory, network, DNS, labels, health
          </span>
        </button>
        {advancedOpen ? (
          <div className="flex flex-col gap-4 border-t border-border p-3">
            <Field
              label="Command"
              value={command}
              onChange={(event) => setCommand(event.target.value)}
              hint="Replaces the command the image runs by default."
            />
            <Field
              label="Entrypoint"
              value={entrypoint}
              onChange={(event) => setEntrypoint(event.target.value)}
            />
            <Field
              label="Working directory"
              placeholder="/app"
              value={workingDir}
              onChange={(event) => setWorkingDir(event.target.value)}
            />
            <Field
              label="User"
              placeholder="1000:1000"
              value={user}
              onChange={(event) => setUser(event.target.value)}
              hint="Run as this user inside the container instead of the image default."
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="CPU limit, in cores"
                placeholder="1.5"
                inputMode="decimal"
                value={cpu}
                onChange={(event) => setCpu(event.target.value)}
              />
              <Field
                label="Memory limit, in MB"
                placeholder="512"
                inputMode="numeric"
                value={memory}
                onChange={(event) => setMemory(event.target.value)}
              />
            </div>
            <Field
              label="Network"
              placeholder="bridge"
              value={network}
              onChange={(event) => setNetwork(event.target.value)}
            />
            <Field
              label="DNS servers"
              placeholder="1.1.1.1, 9.9.9.9"
              value={dns}
              onChange={(event) => setDns(event.target.value)}
              hint="Separate several with commas."
            />
            <RowEditor
              legend="Labels"
              description="Key and value pairs Docker stores with the container."
              rows={labels}
              onAdd={() => setLabels([...labels, { key: '', value: '' }])}
              onRemove={(index) => setLabels(labels.filter((_, at) => at !== index))}
              addLabel="Add a label"
              renderRow={(row, index) => (
                <>
                  <input
                    className={inputClass}
                    aria-label={`Label name ${index + 1}`}
                    value={row.key}
                    onChange={(event) =>
                      setLabels(
                        labels.map((entry, at) =>
                          at === index ? { ...entry, key: event.target.value } : entry,
                        ),
                      )
                    }
                  />
                  <input
                    className={inputClass}
                    aria-label={`Label value ${index + 1}`}
                    value={row.value}
                    onChange={(event) =>
                      setLabels(
                        labels.map((entry, at) =>
                          at === index ? { ...entry, value: event.target.value } : entry,
                        ),
                      )
                    }
                  />
                </>
              )}
            />
            <Field
              label="Health check command"
              placeholder="curl -f localhost/health"
              value={healthCommand}
              onChange={(event) => setHealthCommand(event.target.value)}
              hint="Run inside the container to decide whether it is healthy."
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Health check interval, in seconds"
                placeholder="30"
                inputMode="numeric"
                value={healthInterval}
                onChange={(event) => setHealthInterval(event.target.value)}
              />
              <Field
                label="Health check retries"
                placeholder="3"
                inputMode="numeric"
                value={healthRetries}
                onChange={(event) => setHealthRetries(event.target.value)}
              />
            </div>
          </div>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      {created ? (
        <Text variant="body-sm" tone="secondary">
          {created} is running on this server.
        </Text>
      ) : null}

      <div>
        <Button type="submit" disabled={!canSubmit}>
          {submitting ? 'Creating' : 'Run container'}
        </Button>
      </div>
    </form>
  );
}

/** A repeatable group of rows with one add control and a remove per row. */
function RowEditor<T>({
  legend,
  description,
  rows,
  renderRow,
  onAdd,
  onRemove,
  addLabel,
}: {
  legend: string;
  description: string;
  rows: T[];
  renderRow: (row: T, index: number) => React.ReactNode;
  onAdd: () => void;
  onRemove: (index: number) => void;
  addLabel: string;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-medium text-ink">{legend}</legend>
      <Text variant="caption" tone="secondary">
        {description}
      </Text>
      {rows.map((row, index) => (
        <div key={index} className="flex flex-wrap items-center gap-2">
          {renderRow(row, index)}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            aria-label={`Remove ${legend.toLowerCase()} row ${index + 1}`}
            onClick={() => onRemove(index)}
          >
            <X width={14} height={14} aria-hidden />
          </Button>
        </div>
      ))}
      <div>
        <Button type="button" size="sm" variant="secondary" onClick={onAdd}>
          <Plus width={14} height={14} aria-hidden />
          {addLabel}
        </Button>
      </div>
    </fieldset>
  );
}
