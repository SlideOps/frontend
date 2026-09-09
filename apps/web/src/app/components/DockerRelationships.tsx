import { Card, Text } from '@slideops/design-system';
import {
  ArrowRight,
  Boxes,
  Container as ContainerIcon,
  Database,
  Info,
  Network,
} from '@slideops/icons';
import { Link } from 'react-router-dom';
import {
  relationshipsFor,
  type DockerInventory,
  type DockerResourceKind,
  type DockerResourceRef,
  type RelatedResource,
} from '../docker-analysis';

/*
 * What this thing uses, and what would be affected if it went away.
 *
 * The question an Operator actually asks before removing anything is "what
 * breaks", and until now the only way to answer it was to read four lists and
 * hold them in your head. This answers it from records the page has already
 * loaded, with no extra request to the server and no graph library: the answer
 * is a list of names, and a list is the thing you can act on.
 *
 * What it cannot see is printed rather than omitted. A list nobody read comes
 * back as "not read" instead of as an empty answer, because "no volumes use
 * this" and "nobody looked at the volumes" are different sentences and only one
 * of them is safe to delete something on.
 */

const kindIcon: Record<DockerResourceKind, typeof ContainerIcon> = {
  container: ContainerIcon,
  volume: Database,
  network: Network,
  image: Boxes,
};

const kindLabel: Record<DockerResourceKind, string> = {
  container: 'Containers',
  volume: 'Volumes',
  network: 'Networks',
  image: 'Images',
};

/** One related thing, linked when there is somewhere to go. */
function Related({ resource, nodeId }: { resource: RelatedResource; nodeId: string }) {
  const Icon = kindIcon[resource.kind];
  return (
    <li className="flex items-baseline gap-2 py-1">
      <Icon width={14} height={14} className="mt-0.5 shrink-0 text-ink-muted" aria-hidden />
      <div className="min-w-0">
        {resource.kind === 'container' ? (
          <Link
            to={`/app/docker/containers/${encodeURIComponent(resource.name)}?node=${nodeId}`}
            className="text-sm text-brand underline transition-colors duration-fast ease-standard hover:text-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            {resource.name}
          </Link>
        ) : (
          <Text as="span" variant="body-sm">
            {resource.name}
          </Text>
        )}
        {resource.detail ? (
          <Text variant="caption" tone="secondary" className="block">
            {resource.detail}
          </Text>
        ) : null}
      </div>
    </li>
  );
}

/** One side of the relationship, or a plain sentence when there is nothing. */
function Side({
  title,
  description,
  resources,
  nodeId,
}: {
  title: string;
  description: string;
  resources: RelatedResource[];
  nodeId: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div>
        <Text variant="body-sm" className="font-medium">
          {title}
        </Text>
        <Text variant="caption" tone="secondary" className="block">
          {description}
        </Text>
      </div>
      {resources.length === 0 ? (
        <Text variant="body-sm" tone="secondary">
          Nothing.
        </Text>
      ) : (
        <ul className="rounded-md border border-border bg-subtle px-3 py-1">
          {resources.map((resource) => (
            <Related
              key={`${resource.kind}:${resource.name}`}
              resource={resource}
              nodeId={nodeId}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * The relationships around one container, volume, network or image.
 *
 * Inventory is whatever the caller has: passing only containers is a valid and
 * honest call, and produces an answer that says which lists it could not see.
 */
export function DockerRelationships({
  nodeId,
  target,
  inventory,
}: {
  nodeId: string;
  target: DockerResourceRef;
  inventory: DockerInventory;
}) {
  const relationships = relationshipsFor(target, inventory);

  if (!relationships.found) {
    return (
      <Card>
        <Text variant="body-sm" tone="secondary">
          Nothing on this server is named {target.name}, so there is nothing to relate it to.
        </Text>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <ArrowRight width={16} height={16} className="text-ink-muted" aria-hidden />
        <Text variant="body-sm" className="font-medium">
          What {target.name} is connected to
        </Text>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Side
          title="Uses"
          description="What this depends on to run."
          resources={relationships.uses}
          nodeId={nodeId}
        />
        <Side
          title="Used by"
          description="What would be affected if this went away."
          resources={relationships.usedBy}
          nodeId={nodeId}
        />
      </div>

      {relationships.peers.length > 0 ? (
        <Side
          title="Alongside"
          description="Related, but neither depending on this nor depended on by it."
          resources={relationships.peers}
          nodeId={nodeId}
        />
      ) : null}

      {/* The caveats are the point. An empty list from a list nobody read is
          not an answer, and this is where that gets said out loud. */}
      {relationships.notRead.length > 0 || relationships.notes.length > 0 ? (
        <div className="flex items-start gap-2 rounded-md border border-border bg-subtle px-3 py-2">
          <Info width={15} height={15} className="mt-0.5 shrink-0 text-info" aria-hidden />
          <div className="flex flex-col gap-1">
            {relationships.notRead.length > 0 ? (
              <Text variant="caption" tone="secondary">
                Not read on this page:{' '}
                {relationships.notRead.map((kind) => kindLabel[kind].toLowerCase()).join(', ')}. An
                empty answer above does not rule those out.
              </Text>
            ) : null}
            {relationships.notes.map((note) => (
              <Text key={note} variant="caption" tone="secondary">
                {note}
              </Text>
            ))}
          </div>
        </div>
      ) : null}
    </Card>
  );
}
