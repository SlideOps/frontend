import {
  getReport,
  listNodes,
  type Report,
  type ReportSection,
  type ReportType,
} from '@slideops/api-client';
import { Button, Card, Text, cn } from '@slideops/design-system';
import { FileText, Printer } from '@slideops/icons';
import { Guidance } from '@slideops/tooltips';
import { PageHeader } from '@slideops/ui';
import { useMemo, useState } from 'react';
import { ErrorNote, Loading } from '../components/Feedback';
import { OperatorShell } from '../components/OperatorShell';
import { useAsyncData } from '../hooks/useAsyncData';

interface ReportChoice {
  type: ReportType;
  label: string;
  blurb: string;
}

const REPORT_TYPES: ReportChoice[] = [
  { type: 'health', label: 'Health', blurb: 'Current and recent Node metrics.' },
  { type: 'verification', label: 'Verification', blurb: 'Recent verification results and evidence.' },
  { type: 'inventory', label: 'Inventory', blurb: 'Nodes with their OS, distro, and key facts.' },
  { type: 'operations', label: 'Operations', blurb: 'A history summary with counts and outcomes.' },
  { type: 'security', label: 'Security', blurb: 'The SSH and firewall posture per Node.' },
];

const selectClass =
  'h-10 rounded-md border border-border bg-surface px-3 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus';

/** Render one section of a report, whichever of its shapes the backend supplied. */
function SectionView({ section }: { section: ReportSection }) {
  return (
    <section className="border-t border-border pt-4">
      <Text variant="h4">{section.title}</Text>
      {section.summary ? (
        <Text variant="body-sm" tone="secondary" className="mt-1">
          {section.summary}
        </Text>
      ) : null}
      {section.rows && section.rows.length > 0 ? (
        <dl className="mt-3 divide-y divide-border">
          {section.rows.map((row, index) => (
            <div key={index} className="grid grid-cols-[12rem_1fr] gap-3 py-2">
              <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">{row.label}</dt>
              <dd className="min-w-0 break-words text-sm text-ink">{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {section.items && section.items.length > 0 ? (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-ink">
          {section.items.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      ) : null}
      {section.table && section.table.rows.length > 0 ? (
        <div className="mt-3 overflow-x-auto rounded-md border border-border">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="border-b border-border bg-subtle/40">
              <tr>
                {section.table.headers.map((header, index) => (
                  <th key={index} scope="col" className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {section.table.rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className="px-3 py-2 text-ink">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {section.text ? (
        <Text variant="body-sm" className="mt-3 whitespace-pre-wrap">
          {section.text}
        </Text>
      ) : null}
    </section>
  );
}

/** The whole report, rendered from its structured sections with a readable fallback. */
function ReportView({ report }: { report: Report }) {
  const hasSections = report.sections && report.sections.length > 0;
  return (
    <Card className="print-surface">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Text variant="h3">{report.title ?? `${report.type} report`}</Text>
        {report.generated_at ? (
          <Text variant="body-sm" tone="secondary">
            Generated {new Date(report.generated_at).toLocaleString()}
          </Text>
        ) : null}
      </div>
      {report.summary ? (
        <Text variant="body" tone="secondary" className="mt-2">
          {report.summary}
        </Text>
      ) : null}

      <div className="mt-4 flex flex-col gap-4">
        {hasSections ? (
          report.sections?.map((section, index) => <SectionView key={index} section={section} />)
        ) : report.text ? (
          <Text variant="body-sm" as="pre" className="whitespace-pre-wrap font-mono">
            {report.text}
          </Text>
        ) : (
          <Text variant="body-sm" tone="secondary">
            This report has no content to show.
          </Text>
        )}
      </div>
    </Card>
  );
}

/** Reports: pick a type and optional Node, then read the generated report or print it. */
export function Reports() {
  const [type, setType] = useState<ReportType>('health');
  const [nodeId, setNodeId] = useState<string>('');

  const nodes = useAsyncData((signal) => listNodes(signal), []);
  const params = useMemo(() => ({ type, nodeId: nodeId || undefined }), [type, nodeId]);
  const { state } = useAsyncData(
    (signal) => getReport(params.type, params.nodeId, signal),
    [params],
  );

  return (
    <OperatorShell active="reports">
      <div className="print-hide">
        <PageHeader
          title="Reports"
          description="Generate a readable report from your Operations, verifications, discoveries, and metrics. Pick a type, scope it to a Node if you like, and print it when you need a record."
          guidanceKey="reports.overview"
          actions={
            <Button variant="secondary" onClick={() => window.print()} disabled={state.status !== 'ready'}>
              <Printer width={16} height={16} aria-hidden />
              Print
            </Button>
          }
        />

        <div className="mb-6 flex flex-col gap-4">
          <div
            className="flex flex-wrap gap-2"
            role="group"
            aria-label="Report type"
          >
            {REPORT_TYPES.map((choice) => (
              <button
                key={choice.type}
                type="button"
                onClick={() => setType(choice.type)}
                aria-pressed={type === choice.type}
                title={choice.blurb}
                className={cn(
                  'rounded-pill border px-4 py-2 text-sm font-medium transition-colors duration-fast ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus',
                  type === choice.type
                    ? 'border-brand bg-brand text-brand-fg'
                    : 'border-border bg-surface text-ink hover:bg-subtle',
                )}
              >
                {choice.label}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-2 text-sm text-ink-muted">
            <span>Node</span>
            <select
              className={selectClass}
              value={nodeId}
              onChange={(event) => setNodeId(event.target.value)}
              aria-label="Scope the report to a Node"
            >
              <option value="">All Nodes</option>
              {nodes.state.status === 'ready'
                ? nodes.state.data.map((node) => (
                    <option key={node.id} value={node.id}>
                      {node.name}
                    </option>
                  ))
                : null}
            </select>
            <Guidance for="reports.scope" />
          </label>
        </div>
      </div>

      {state.status === 'loading' ? <Loading label="Generating the report" /> : null}
      {state.status === 'error' ? (
        <div className="print-hide">
          <ErrorNote error={state.error} />
        </div>
      ) : null}
      {state.status === 'ready' ? (
        <>
          <div className="print-only mb-4 hidden">
            <div className="flex items-center gap-2">
              <FileText width={18} height={18} aria-hidden />
              <span className="text-sm font-semibold">SlideOps report</span>
            </div>
          </div>
          <ReportView report={state.data} />
        </>
      ) : null}
    </OperatorShell>
  );
}
