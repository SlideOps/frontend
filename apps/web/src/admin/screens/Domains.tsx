import { listAdminDomains, type AdminDomain } from '@slideops/api-client';
import { CheckCircle2, Globe, XCircle } from '@slideops/icons';
import { EmptyState, PageHeader } from '@slideops/ui';
import { AdminShell } from '../components/AdminShell';
import { ErrorNote, Loading } from '../components/Feedback';
import { TBody, TD, TH, THead, TR, Table } from '../components/Table';
import { useAsyncData } from '../hooks/useAsyncData';

/*
 * Every domain on the platform, and where in the chain each one is.
 *
 * The question an admin actually has is not "is DNS working" or "is the
 * certificate valid". It is: somebody says their site is down, which of the four
 * things behind it broke. So the table is those four, side by side, one row per
 * hostname: DNS, routing, the certificate, and what it points at.
 *
 * They stay separate columns rather than collapsing into one status because they
 * fail separately and each has a different fix. A row with DNS verified and no
 * certificate is somebody whose record is right and whose port 80 is shut; a row
 * with neither is somebody who has not created the record yet. One "failed"
 * column would make those look the same and send an admin to a terminal to tell
 * them apart, which is the work this screen exists to remove.
 */

function when(value?: string): string {
  return value ? new Date(value).toLocaleString() : '';
}

/** A tick or a cross, with what it means underneath when it is not obvious. */
function Yes({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 font-medium text-success">
      <CheckCircle2 width={14} height={14} aria-hidden />
      {children}
    </span>
  );
}

function No({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-ink-muted">
      <XCircle width={14} height={14} aria-hidden />
      {children}
    </span>
  );
}

/** Whether DNS has been seen to point at this hostname's own target. */
function dnsResolved(domain: AdminDomain): boolean {
  return (
    domain.state !== 'pending_dns' && domain.state !== 'dns_verifying' && domain.state !== 'failed'
  );
}

/** Whether the route exists on the server. */
function routed(domain: AdminDomain): boolean {
  return (
    domain.state === 'routing_active' ||
    domain.state === 'tls_pending' ||
    domain.state === 'active' ||
    domain.state === 'degraded'
  );
}

export function Domains() {
  const domains = useAsyncData<AdminDomain[]>(() => listAdminDomains(), []);

  return (
    <AdminShell active="domains">
      <PageHeader
        title="Domains"
        description="Every hostname on the platform, and which of the four things behind it is not working. Read only."
      />

      {domains.state.status === 'loading' ? <Loading /> : null}
      {domains.state.status === 'error' ? <ErrorNote error={domains.state.error} /> : null}

      {domains.state.status === 'ready' ? (
        domains.state.data.length === 0 ? (
          <EmptyState
            icon={Globe}
            title="No domains yet"
            description="Hostnames appear here once someone adds one to a Service."
          />
        ) : (
          <Table label="Domains on this platform, with the state of DNS, routing and the certificate for each">
            <THead>
              <TR>
                <TH>Hostname</TH>
                <TH>DNS</TH>
                <TH>Routing</TH>
                <TH>Certificate</TH>
                <TH>Points at</TH>
                <TH>Last checked</TH>
              </TR>
            </THead>
            <TBody>
              {domains.state.data.map((domain) => (
                <TR key={domain.hostname}>
                  <TD>
                    <div className="font-mono">{domain.hostname}</div>
                    {/* The reason, where there is one. An admin reading this row
                        should not have to open anything else to know why. */}
                    {domain.last_error ? (
                      <div className="mt-1 text-xs text-ink-muted">{domain.last_error}</div>
                    ) : (
                      <div className="mt-1 text-xs text-ink-muted">{domain.state_detail}</div>
                    )}
                  </TD>
                  <TD>
                    {dnsResolved(domain) ? (
                      <Yes>Resolves</Yes>
                    ) : (
                      <No>{domain.dns_observed ? 'Points elsewhere' : 'Not resolving'}</No>
                    )}
                    {domain.dns_observed ? (
                      <div className="mt-1 font-mono text-xs text-ink-muted">
                        {domain.dns_observed}
                      </div>
                    ) : null}
                  </TD>
                  <TD>{routed(domain) ? <Yes>Routed</Yes> : <No>No route</No>}</TD>
                  <TD>
                    {domain.tls_state === 'active' ? (
                      <Yes>Valid</Yes>
                    ) : (
                      <No>{domain.tls_state === 'failed' ? 'Failed' : 'None yet'}</No>
                    )}
                    {domain.tls_expires_at ? (
                      <div className="mt-1 text-xs text-ink-muted">
                        Expires {when(domain.tls_expires_at)}
                      </div>
                    ) : null}
                  </TD>
                  <TD>
                    <div className="font-mono text-xs">{domain.service_id}</div>
                    <div className="mt-1 text-xs text-ink-muted">
                      port {domain.target_port}
                      {domain.ingress_kind === 'workspace_ingress'
                        ? ', via workspace entry point'
                        : ''}
                    </div>
                  </TD>
                  <TD>{when(domain.dns_checked_at) || '-'}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )
      ) : null}
    </AdminShell>
  );
}
