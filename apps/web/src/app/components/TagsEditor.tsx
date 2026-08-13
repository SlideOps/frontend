import { ApiError, setNodeTags, type Node } from '@slideops/api-client';
import { Button, Card, Text } from '@slideops/design-system';
import { Tags as TagsIcon } from '@slideops/icons';
import { Guidance } from '@slideops/tooltips';
import { useState } from 'react';
import { TagInput } from './TagInput';

/**
 * Edit a Node's tags directly on its detail page. Saving sends the whole set:
 * PATCH /nodes/{id}/tags replaces rather than merges, matching TagInput's own
 * chip-add-and-remove model, so there is nothing to reconcile between them.
 */
export function TagsEditor({ node, onSaved }: { node: Node; onSaved: (updated: Node) => void }) {
  const [tags, setTags] = useState(node.tags);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = JSON.stringify(tags) !== JSON.stringify(node.tags);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const updated = await setNodeTags(node.id, tags);
      onSaved(updated);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'The tags could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <div className="mb-3 flex items-center gap-2">
        <TagsIcon width={18} height={18} className="text-brand" aria-hidden />
        <Text variant="h4">Tags</Text>
        <Guidance for="node.tags" />
      </div>
      <Text variant="body-sm" tone="secondary" className="mb-4">
        Search and group this server in the Servers list by any labels you give it.
      </Text>
      <TagInput value={tags} onChange={setTags} />
      {error ? (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      ) : null}
      <div className="mt-4">
        <Button onClick={save} disabled={!dirty || saving}>
          {saving ? 'Saving' : 'Save tags'}
        </Button>
      </div>
    </Card>
  );
}
