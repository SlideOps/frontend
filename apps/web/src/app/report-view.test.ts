import { describe, expect, it } from 'vitest';
import type { Report } from '@slideops/api-client';
import fixtures from './__fixtures__/reports.json';
import { reportSections, reportTitle } from './report-view';

/*
 * These run against payloads captured from the real API, not payloads invented
 * to match the code. That is the whole point: the Reports screen rendered
 * `report.sections`, the API has never sent that field, and every report fell
 * through to "This report has no content to show" while the backend was
 * returning twelve kilobytes of evidence. A test written against an assumed
 * shape would have passed throughout.
 */

const reports = fixtures as unknown as Record<string, Report>;

/** Every string a section puts on screen, for asserting on content. */
function rendered(report: Report): string {
  return reportSections(report)
    .map((section) =>
      [
        section.title,
        section.summary ?? '',
        (section.rows ?? []).map((row) => `${row.label} ${row.value}`).join(' '),
        (section.items ?? []).join(' '),
        (section.table?.headers ?? []).join(' '),
        (section.table?.rows ?? []).flat().join(' '),
      ].join(' '),
    )
    .join('\n');
}

describe('reportSections', () => {
  // The bug, pinned: not one of the five report types produced anything.
  it('produces content for every report type the API returns', () => {
    for (const [type, report] of Object.entries(reports)) {
      const sections = reportSections(report);
      expect(sections.length, `${type} produced no sections`).toBeGreaterThan(0);
      expect(rendered(report).trim().length, `${type} rendered nothing`).toBeGreaterThan(40);
    }
  });

  it('leads a verification report with the answer, then the evidence', () => {
    const sections = reportSections(reports.verification!);
    expect(sections[0]?.title).toBe('Summary');
    // 22 of 22 passed on the server this was captured from.
    expect(sections[0]?.summary).toMatch(/22/);
    // The checks are what make it evidence rather than an assertion.
    const evidence = sections.filter((section) => section.title.startsWith('Evidence:'));
    expect(evidence.length).toBeGreaterThan(0);
    expect(evidence[0]?.items?.length).toBeGreaterThan(0);
  });

  it('lists the servers in an inventory report with what they run', () => {
    const out = rendered(reports.inventory!);
    expect(out).toContain('169.58.53.167');
    expect(out).toMatch(/Ubuntu/);
  });

  it('counts operations by status and by Capability, most run first', () => {
    const sections = reportSections(reports.operations!);
    const byCapability = sections.find((section) => section.title === 'By Capability');
    const counts = (byCapability?.table?.rows ?? []).map((row) => Number(row[1]));
    expect(counts.length).toBeGreaterThan(1);
    expect([...counts].sort((a, b) => b - a)).toEqual(counts);
  });

  // "false" is not obviously the good outcome at a glance, so the posture is
  // stated as the answer rather than as the raw value.
  it('states security posture in words rather than raw booleans', () => {
    const out = rendered(reports.security!);
    expect(out).toMatch(/Refused|Allowed/);
    expect(out).not.toMatch(/password_authentication/);
  });

  it('renders health with a readable uptime rather than a large number', () => {
    const out = rendered(reports.health!);
    expect(out).toMatch(/day|hour|minute/);
    // The raw seconds should not be what an Operator reads.
    expect(out).not.toMatch(/812764/);
  });

  // A backend that starts sending sections itself must win, so this never fights
  // a future API.
  it('uses sections the backend supplies, when it supplies them', () => {
    const supplied: Report = {
      type: 'operations',
      sections: [{ title: 'From the backend', summary: 'Sent as sections.' }],
    };
    expect(reportSections(supplied)).toEqual(supplied.sections);
  });

  it('returns nothing for a type it does not know, rather than guessing', () => {
    expect(reportSections({ type: 'something-new' } as Report)).toEqual([]);
  });

  // An empty payload is a real case: a fresh account has run nothing. It should
  // say so rather than render blank.
  it('says plainly when there is genuinely nothing yet', () => {
    expect(
      reportSections({ type: 'inventory', data: { nodes: [] } } as unknown as Report)[0]?.summary,
    ).toMatch(/No servers/i);
    expect(
      reportSections({
        type: 'verification',
        data: { summary: { total: 0 } },
      } as unknown as Report)[0]?.summary,
    ).toMatch(/No Operations/i);
  });
});

describe('reportTitle', () => {
  it('names each report in the Operator’s terms', () => {
    expect(reportTitle(reports.verification!)).toBe('Verification report');
    expect(reportTitle(reports.security!)).toBe('Security posture report');
  });

  it('prefers a title the backend supplied', () => {
    expect(reportTitle({ type: 'health', title: 'Q3 health' } as Report)).toBe('Q3 health');
  });
});
