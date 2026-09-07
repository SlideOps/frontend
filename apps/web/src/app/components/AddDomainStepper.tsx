import {
  ApiError,
  addServiceDomain,
  listServiceDomains,
  provisionDomain,
  verifyDomain,
  type Domain,
  type Node,
  type Service,
} from '@slideops/api-client';
import { Button, Section, Text } from '@slideops/design-system';
import { AlertTriangle, Check, Globe } from '@slideops/icons';
import { useState, type ReactNode } from 'react';
import {
  certificateReading,
  dnsReading,
  dnsVerified,
  routeWritten,
  servingReading,
} from '../domain-status';
import { DomainRecordFields, ExpectedFound, StatusPill } from './DomainStatus';

/*
 * Adding a domain, one honest step at a time.
 *
 * Four separate things have to become true and only one of them is SlideOps' to
 * do. A single "Add domain" button that reports failure when any of them is not
 * yet true is what sends an Operator to a terminal to find out which, so the
 * four are walked through in the order they actually happen, each saying what it
 * is about to do before it does it and showing what really came back afterwards.
 *
 * Two rules hold the whole thing together. Nothing is applied without the
 * Operator pressing something: the DNS check and the provisioning call both act
 * on the world, and neither runs because a screen loaded. And a step that has
 * not been satisfied does not open the next one, because carrying on to request
 * a certificate while DNS still points at somebody else's server produces a
 * failure that reads as SlideOps being broken.
 */

const inputClass =
  'w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus';

export function AddDomainStepper({
  services,
  nodes,
  onFinished,
  onCancel,
}: {
  services: Service[];
  nodes: Node[];
  /** Called when the Operator leaves the stepper, so the list can be re-read. */
  onFinished: () => void;
  onCancel: () => void;
}) {
  const [step, setStep] = useState(0);
  const [serviceId, setServiceId] = useState('');
  const [hostname, setHostname] = useState('');
  const [port, setPort] = useState('');
  const [domain, setDomain] = useState<Domain | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  const service = services.find((candidate) => candidate.id === serviceId) ?? null;
  const node = service
    ? (nodes.find((candidate) => candidate.id === service.node_id) ?? null)
    : null;
  const serverName = node?.name ?? 'the server this Service runs on';

  const run = async (action: () => Promise<Domain>): Promise<Domain | null> => {
    setBusy(true);
    setError(null);
    try {
      const result = await action();
      setDomain(result);
      return result;
    } catch (caught) {
      // The backend's own words. It knows things this screen does not, such as
      // that provisioning was refused because DNS is not ready yet.
      setError(caught instanceof ApiError ? caught.message : 'That did not work. Try again.');
      return null;
    } finally {
      setBusy(false);
    }
  };

  const claim = async () => {
    const parsed = Number(port);
    if (!Number.isInteger(parsed) || parsed < 1) {
      setError('Enter the port your application listens on inside its container, such as 3000.');
      return;
    }
    const result = await run(() => addServiceDomain(serviceId, hostname.trim(), parsed));
    if (result) {
      setStep(2);
    }
  };

  const check = async (id: string) => {
    const result = await run(() => verifyDomain(id));
    if (result) {
      setChecked(true);
      // Advancing is a consequence of what DNS answered, not of the button
      // having been pressed. A check that found the wrong address leaves this
      // step open and the later ones closed.
      if (dnsVerified(result)) {
        setStep(4);
      }
    }
  };

  const putLive = async (id: string) => {
    const result = await run(() => provisionDomain(id));
    if (result && routeWritten(result)) {
      setStep(5);
    }
  };

  const reread = async (id: string) => {
    setBusy(true);
    setError(null);
    try {
      const all = await listServiceDomains(serviceId);
      const fresh = all.find((candidate) => candidate.id === id);
      if (fresh) {
        setDomain(fresh);
      }
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'That did not work. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section
      title="Add a domain"
      adornment={<Globe width={16} height={16} className="text-brand" aria-hidden />}
      description="Six steps, in the order they actually happen. Each says what it is about to do, and shows what came back."
      action={
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      }
    >
      <ol className="flex flex-col gap-3">
        <Step
          index={0}
          current={step}
          title="Which Service is this domain for"
          summary="A domain belongs to a Service. Choosing the Service also decides which server answers for it."
          done={
            service ? (
              <Text variant="body-sm" tone="secondary">
                {service.name}, running on {serverName}.
              </Text>
            ) : null
          }
        >
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <label htmlFor="stepper-service" className="text-sm font-medium text-ink">
                Service
              </label>
              <select
                id="stepper-service"
                className={inputClass}
                value={serviceId}
                onChange={(event) => setServiceId(event.target.value)}
              >
                <option value="">Choose a Service</option>
                {services.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.name}
                  </option>
                ))}
              </select>
            </div>
            {/* Which server answers is a consequence of the Service, not a
                separate choice. Saying so is what stops an Operator hunting for
                a server picker that does not exist. */}
            <Text variant="caption" tone="secondary">
              {service
                ? `${service.name} runs on ${serverName}, so that is what will answer for this hostname. One server can answer for as many hostnames as you have Services on it, each with its own.`
                : 'A domain points at a Service. The server follows from the Service, so there is no separate server to choose.'}
            </Text>
            <div>
              <Button size="sm" disabled={serviceId === ''} onClick={() => setStep(1)}>
                Continue
              </Button>
            </div>
          </div>
        </Step>

        <Step
          index={1}
          current={step}
          title="The name, and the port it listens on"
          summary="Claiming the name records it and returns the exact record to create. Nothing on any server changes."
          done={
            domain ? (
              <Text variant="body-sm" tone="secondary" className="font-mono">
                {domain.hostname} to port {domain.target_port}
              </Text>
            ) : null
          }
        >
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <label htmlFor="stepper-hostname" className="text-sm font-medium text-ink">
                Hostname
              </label>
              <input
                id="stepper-hostname"
                className={`${inputClass} font-mono`}
                placeholder="api.example.com"
                value={hostname}
                onChange={(event) => setHostname(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="stepper-port" className="text-sm font-medium text-ink">
                Port your application listens on
              </label>
              <input
                id="stepper-port"
                className={`${inputClass} font-mono`}
                placeholder="3000"
                value={port}
                onChange={(event) => setPort(event.target.value)}
              />
              <Text variant="caption" tone="secondary">
                The port inside the container. Visitors always arrive on https whatever this is, so
                you do not need to publish it.
              </Text>
            </div>
            <WillHappen>
              The name is recorded against {service?.name ?? 'this Service'} and the exact DNS
              record comes back. No port is opened, no route is written, and no certificate is
              requested yet.
            </WillHappen>
            <div>
              <Button disabled={busy || hostname.trim() === ''} onClick={claim}>
                {busy ? 'Claiming' : 'Claim the hostname'}
              </Button>
            </div>
          </div>
        </Step>

        <Step
          index={2}
          current={step}
          title="Create the DNS record"
          summary="The one part SlideOps cannot do for you, unless your DNS is connected to it."
          // The record stays on screen for the rest of the journey rather than
          // scrolling away behind a completed tick: it is what the next step
          // compares against, and what gets pasted into a registrar's form.
          done={
            domain ? (
              <div className="rounded-md border border-border bg-subtle px-3 py-2">
                <DomainRecordFields domain={domain} />
              </div>
            ) : null
          }
        >
          {domain ? (
            <div className="flex flex-col gap-3">
              <Text variant="body-sm" tone="secondary">
                Create this record with whoever manages DNS for {domain.hostname}. If you have
                connected DNS to SlideOps for that zone, this is what SlideOps created for you.
              </Text>
              <div className="rounded-md border border-border bg-subtle px-3 py-2">
                <DomainRecordFields domain={domain} />
              </div>
              <Text variant="caption" tone="secondary">
                Changes take a while to spread, so the next step may need running more than once.
              </Text>
              <div>
                <Button size="sm" onClick={() => setStep(3)}>
                  The record is created
                </Button>
              </div>
            </div>
          ) : null}
        </Step>

        <Step
          index={3}
          current={step}
          title="Check what DNS actually answers"
          summary="A real lookup, so you find out what the world sees rather than what SlideOps hopes."
          done={
            domain ? (
              <ExpectedFound
                expected={domain.record.value}
                found={domain.dns_observed ?? 'no answer'}
              />
            ) : null
          }
        >
          {domain ? (
            <div className="flex flex-col gap-3">
              <WillHappen>
                SlideOps asks a resolver for {domain.hostname} and records what answered. Nothing on
                any server changes.
              </WillHappen>
              <div>
                <Button disabled={busy} onClick={() => check(domain.id)}>
                  {busy ? 'Checking' : 'Check DNS now'}
                </Button>
              </div>
              {checked ? (
                <div className="rounded-md border border-border px-3 py-2">
                  <ExpectedFound
                    expected={domain.record.value}
                    found={domain.dns_observed ?? 'no answer'}
                  />
                  <Text variant="caption" tone="secondary" className="mt-2 block">
                    {domain.state_detail}
                  </Text>
                </div>
              ) : null}
              {checked && !dnsVerified(domain) ? (
                <Blocked>
                  DNS does not point here yet, so there is nothing to route a request to and no
                  certificate can be issued for the name. Fix the record and check again. This step
                  stays open until a lookup answers with the value above.
                </Blocked>
              ) : null}
            </div>
          ) : null}
        </Step>

        <Step
          index={4}
          current={step}
          title="Routing and the certificate"
          summary="The web ports are opened, the route for this hostname is written, and a certificate is requested."
          done={
            domain ? (
              <Text variant="body-sm" tone="secondary">
                {domain.state_detail}
              </Text>
            ) : null
          }
        >
          {domain ? (
            <div className="flex flex-col gap-3">
              <WillHappen>
                The web ports are opened on {serverName}, a route for {domain.hostname} alone is
                written, and a certificate is requested for it. Sites already served by that server
                are not touched.
              </WillHappen>
              <div>
                <Button disabled={busy} onClick={() => putLive(domain.id)}>
                  {busy ? 'Putting it live' : 'Put it live'}
                </Button>
              </div>
              {domain.dns_checked_at ? (
                <div className="flex flex-wrap gap-6 rounded-md border border-border px-3 py-2">
                  <StatusPill
                    label="Where it has got to"
                    reading={{ label: domain.state_detail, tone: 'muted' }}
                  />
                  <StatusPill label="Certificate" reading={certificateReading(domain)} />
                </div>
              ) : null}
            </div>
          ) : null}
        </Step>

        <Step
          index={5}
          current={step}
          title="Confirm it serves the Service"
          summary="The check that matters: a visitor typing the name reaches the application."
          done={null}
        >
          {domain ? (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-6 rounded-md border border-border px-3 py-2">
                <StatusPill label="DNS" reading={dnsReading(domain)} />
                <StatusPill label="Certificate" reading={certificateReading(domain)} />
                <StatusPill label="Serving" reading={servingReading(domain)} />
              </div>
              {domain.serving ? (
                <div className="flex items-center gap-2">
                  <Check width={16} height={16} className="shrink-0 text-success" aria-hidden />
                  <a
                    href={domain.url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-sm text-brand underline"
                  >
                    {domain.hostname}
                  </a>
                </div>
              ) : (
                <Blocked>
                  {domain.last_error ??
                    'The hostname is not serving this Service yet. Check again in a moment: a certificate can take a little while to issue.'}
                </Blocked>
              )}
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" disabled={busy} onClick={() => reread(domain.id)}>
                  {busy ? 'Checking' : 'Check again'}
                </Button>
                <Button size="sm" onClick={onFinished}>
                  Done
                </Button>
              </div>
            </div>
          ) : null}
        </Step>
      </ol>

      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </Section>
  );
}

/** What the next press will do, said before it is pressed. */
function WillHappen({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-border bg-app px-3 py-2">
      <Text variant="caption" tone="secondary" className="block font-medium">
        What this will do
      </Text>
      <Text variant="body-sm" tone="secondary" className="mt-0.5 block">
        {children}
      </Text>
    </div>
  );
}

/** Why the journey stops here, and what would move it on. */
function Blocked({ children }: { children: ReactNode }) {
  return (
    <div
      role="status"
      className="flex items-start gap-2 rounded-md border border-warning bg-subtle px-3 py-2"
    >
      <AlertTriangle width={16} height={16} className="mt-0.5 shrink-0 text-warning" aria-hidden />
      <Text variant="body-sm" tone="secondary">
        {children}
      </Text>
    </div>
  );
}

/**
 * One step.
 *
 * A step that has not been reached shows its heading and its one line, so the
 * whole journey is readable from the start instead of arriving a surprise at a
 * time, but none of its controls exist: a disabled "Put it live" beside an
 * unverified record is still an invitation, and a rendered one is a way to skip
 * the check. A step already passed keeps only its result.
 */
function Step({
  index,
  current,
  title,
  summary,
  done,
  children,
}: {
  index: number;
  current: number;
  title: string;
  summary: string;
  done: ReactNode;
  children: ReactNode;
}) {
  const active = index === current;
  const passed = index < current;
  return (
    <li className={`rounded-md border px-4 py-3 ${active ? 'border-brand' : 'border-border'}`}>
      <div className="flex items-baseline gap-2">
        <span className="text-sm font-medium text-ink-muted">Step {index + 1}</span>
        <Text variant="body-sm" className="font-medium">
          {title}
        </Text>
        {passed ? (
          <Check width={14} height={14} className="shrink-0 text-success" aria-hidden />
        ) : null}
      </div>
      <Text variant="caption" tone="secondary" className="mt-0.5 block">
        {summary}
      </Text>
      {active ? <div className="mt-3">{children}</div> : null}
      {passed && done ? <div className="mt-2">{done}</div> : null}
    </li>
  );
}
