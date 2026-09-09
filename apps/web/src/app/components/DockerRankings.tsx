import type { DockerContainer, DockerStats } from '@slideops/api-client';
import { Card, Text } from '@slideops/design-system';
import { Cpu, MemoryStick, RotateCcw } from '@slideops/icons';
import { Link } from 'react-router-dom';
import {
  RANKING_TOP_N,
  rankByCpu,
  rankByMemory,
  rankByRestarts,
  type Ranking,
} from '../docker-analysis';
import { formatBytes } from '../docker-inventory';

/*
 * Which containers are actually consuming this server.
 *
 * The whole value here is in what is left out. A container with no live sample
 * is excluded from the CPU and memory boards rather than ranked at zero,
 * because the sampling pass covers running containers and treating an unsampled
 * one as idle would say a container nobody measured is doing nothing. So each
 * board carries the count it could not rank, and says so in words rather than
 * quietly showing three rows out of twenty and letting them read as the answer.
 *
 * Restarts are different and are ranked from every container, sampled or not:
 * restart_count is reported on the container itself and needs nothing live.
 */

/** The shared frame: a title, the rows, and an honest note about the rest. */
function Board<T>({
  title,
  icon: Icon,
  ranking,
  unrankedNote,
  row,
}: {
  title: string;
  icon: typeof Cpu;
  ranking: Ranking<T>;
  /** What to say about the ones that could not be ranked. */
  unrankedNote: (excluded: number) => string;
  row: (entry: T, position: number) => React.ReactNode;
}) {
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Icon width={16} height={16} className="text-ink-muted" aria-hidden />
        <Text variant="body-sm" className="font-medium">
          {title}
        </Text>
      </div>

      {ranking.top.length === 0 ? (
        <Text variant="body-sm" tone="secondary">
          {ranking.excluded > 0
            ? unrankedNote(ranking.excluded)
            : 'No containers to rank on this server.'}
        </Text>
      ) : (
        <ol className="flex flex-col gap-2">
          {ranking.top.map((entry, position) => (
            <li key={position}>{row(entry, position)}</li>
          ))}
        </ol>
      )}

      {ranking.top.length > 0 && ranking.excluded > 0 ? (
        <Text variant="caption" tone="secondary">
          {unrankedNote(ranking.excluded)}
        </Text>
      ) : null}
    </Card>
  );
}

/** One row: the position, the name, and the reading it was ranked on. */
function RankRow({
  position,
  container,
  reading,
  nodeId,
}: {
  position: number;
  container: DockerContainer;
  reading: string;
  nodeId: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <div className="flex min-w-0 items-baseline gap-2">
        <Text as="span" variant="caption" tone="secondary" className="w-4 shrink-0 tabular-nums">
          {position + 1}
        </Text>
        <Link
          to={`/app/docker/containers/${encodeURIComponent(container.full_id)}?node=${nodeId}`}
          className="truncate text-sm text-brand underline transition-colors duration-fast ease-standard hover:text-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          {container.name}
        </Link>
      </div>
      <Text as="span" variant="body-sm" className="shrink-0 font-medium tabular-nums">
        {reading}
      </Text>
    </div>
  );
}

/**
 * The three boards, side by side.
 *
 * Live data, taken from whatever the page already loaded rather than fetched
 * again: this is a reading of the same containers and samples the rest of the
 * tab is showing, so it must not be able to disagree with them.
 */
export function DockerRankings({
  nodeId,
  containers,
  stats,
}: {
  nodeId: string;
  containers: DockerContainer[];
  stats: DockerStats[];
}) {
  const cpu = rankByCpu(containers, stats, RANKING_TOP_N);
  const memory = rankByMemory(containers, stats, RANKING_TOP_N);
  const restarts = rankByRestarts(containers, RANKING_TOP_N);

  const sampleNote = (excluded: number) =>
    excluded === 1
      ? '1 container had no live sample and is not ranked here.'
      : `${excluded} containers had no live sample and are not ranked here.`;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Board
        title="Most CPU"
        icon={Cpu}
        ranking={cpu}
        unrankedNote={sampleNote}
        row={(entry, position) => (
          <RankRow
            position={position}
            container={entry.container}
            nodeId={nodeId}
            // Docker reports percent of one core, so 200 is two cores' worth
            // and is not a bug in the reading.
            reading={`${Math.round(entry.cpuPercent)}%`}
          />
        )}
      />

      <Board
        title="Most memory"
        icon={MemoryStick}
        ranking={memory}
        unrankedNote={sampleNote}
        row={(entry, position) => (
          <RankRow
            position={position}
            container={entry.container}
            nodeId={nodeId}
            reading={
              entry.percentOfLimit === null
                ? formatBytes(entry.memoryUsedMb * 1024 * 1024)
                : `${formatBytes(entry.memoryUsedMb * 1024 * 1024)} (${Math.round(entry.percentOfLimit)}%)`
            }
          />
        )}
      />

      <Board
        title="Most restarts"
        icon={RotateCcw}
        ranking={restarts}
        // Restarts need nothing live, so nothing is ever excluded for want of a
        // sample. Saying otherwise would invent a caveat.
        unrankedNote={() => 'Every container reports its own restart count.'}
        row={(entry, position) => (
          <RankRow
            position={position}
            container={entry.container}
            nodeId={nodeId}
            reading={String(entry.restarts)}
          />
        )}
      />
    </div>
  );
}
