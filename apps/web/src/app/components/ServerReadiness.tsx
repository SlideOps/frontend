import { getReadiness, type ReadinessMeasure, type ReadinessSeverity } from '@slideops/api-client';
import { Button, Text } from '@slideops/design-system';
import { Check, ChevronRight, ShieldCheck } from '@slideops/icons';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAsyncData } from '../hooks/useAsyncData';
import { ErrorNote, Loading } from './Feedback';

/*
 * Whether this server is ready, and what is missing.
 *
 * Deliberately not a stack of cards. The old pattern put every fact in its own
 * bordered box, so eight measures became eight boxes and the page got longer the
 * more it had to say, which is backwards: the more there is to know, the more it
 * needs to be scannable. This is one meter and two lists, and the whole state of
 * a server fits above the fold.
 *
 * What is missing leads, because it is the only part that needs a decision. What
 * is already in place is collapsed by default: it is reassurance, and reassurance
 * should be available without being in the way.
 */

const severityDot: Record<ReadinessSeverity, string> = {
  critical: 'bg-danger',
  high: 'bg-danger/70',
  medium: 'bg-warning',
  low: 'bg-ink-muted',
  none: 'bg-success',
};

const severityWord: Record<ReadinessSeverity, string> = {
  critical: 'Critical',
  high: 'Important',
  medium: 'Worth doing',
  low: 'Optional',
  none: '',
};

/** One gap, as a row rather than a box. */
function MissingRow({
  measure,
  onOpen,
}: {
  measure: ReadinessMeasure;
  onOpen: (key: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(measure.capability_key)}
      className="group flex w-full items-start gap-3 rounded-md px-3 py-2.5 text-left transition-colors duration-fast ease-standard hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
    >
      <span
        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${severityDot[measure.severity]}`}
        aria-hidden
      />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <Text variant="body-sm" className="font-medium">
            {measure.title}
          </Text>
          <span className="text-xs text-ink-muted">{severityWord[measure.severity]}</span>
        </span>
        <Text variant="caption" tone="secondary" className="mt-0.5 block">
          {measure.why}
        </Text>
      </span>
      <ChevronRight
        width={16}
        height={16}
        className="mt-1 shrink-0 text-ink-muted transition-transform duration-fast ease-standard group-hover:translate-x-0.5"
        aria-hidden
      />
    </button>
  );
}

/** One thing already in place, quiet by design. */
function SatisfiedRow({ measure }: { measure: ReadinessMeasure }) {
  return (
    <div className="flex items-start gap-3 px-3 py-2">
      <Check width={14} height={14} className="mt-1 shrink-0 text-success" aria-hidden />
      <div className="min-w-0 flex-1">
        <Text variant="body-sm">{measure.title}</Text>
        <Text variant="caption" tone="secondary" className="block">
          {measure.evidence}
        </Text>
      </div>
      {/* Said plainly, because who did it is the interesting part: a server the
          Operator hardened themselves should not read as SlideOps' work. */}
      <span className="shrink-0 text-xs text-ink-muted">
        {measure.state === 'detected' ? 'Already here' : 'Done by SlideOps'}
      </span>
    </div>
  );
}

export function ServerReadiness({ nodeId }: { nodeId: string }) {
  const navigate = useNavigate();
  const { state } = useAsyncData((signal) => getReadiness(nodeId, signal), [nodeId]);
  const [showSatisfied, setShowSatisfied] = useState(false);

  if (state.status === 'loading') {
    return <Loading label="Checking what this server has" />;
  }
  if (state.status === 'error') {
    return <ErrorNote error={state.error} />;
  }

  const {
    satisfied,
    missing,
    summary,
    discovered,
    essentials_missing: essentialsMissing,
  } = state.data;
  const total = satisfied.length + missing.length;
  const inPlace = satisfied.length;
  const percent = total === 0 ? 0 : Math.round((inPlace / total) * 100);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck width={18} height={18} className="text-brand" aria-hidden />
          <Text variant="h4">Server readiness</Text>
        </div>
        <Text variant="caption" tone="secondary" className="tabular-nums">
          {discovered ? `${inPlace} of ${total} in place` : 'Not read yet'}
        </Text>
      </div>

      {/* One meter instead of eight boxes. Green for what is there, and the bar
          is the only chart on the page because a percentage does not need one. */}
      {discovered ? (
        <div
          className="h-1.5 w-full overflow-hidden rounded-pill bg-subtle"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Baseline measures in place"
        >
          <div
            className={`h-full rounded-pill transition-all duration-normal ease-standard ${
              essentialsMissing > 0 ? 'bg-warning' : 'bg-success'
            }`}
            style={{ width: `${percent}%` }}
          />
        </div>
      ) : null}

      <Text variant="body-sm" tone="secondary">
        {summary}
      </Text>

      {missing.length > 0 ? (
        <div className="-mx-3">
          {missing.map((measure) => (
            <MissingRow
              key={measure.capability_key}
              measure={measure}
              onOpen={(key) => navigate(`/app/capabilities/${key}?node=${nodeId}`)}
            />
          ))}
        </div>
      ) : null}

      {satisfied.length > 0 ? (
        <div>
          <Button variant="ghost" size="sm" onClick={() => setShowSatisfied((open) => !open)}>
            {showSatisfied ? 'Hide' : 'Show'} what is already in place ({satisfied.length})
          </Button>
          {showSatisfied ? (
            <div className="mt-2 -mx-3 border-t border-border pt-2">
              {satisfied.map((measure) => (
                <SatisfiedRow key={measure.capability_key} measure={measure} />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
