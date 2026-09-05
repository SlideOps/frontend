import { type PendingInvitation } from '@slideops/api-client';
import { Button, Card, Text } from '@slideops/design-system';
import { Check, Mail, X } from '@slideops/icons';

/** Human labels for a workspace member's role, shared wherever one is shown. */
export const roleLabel: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
  viewer: 'Viewer',
};

/**
 * One invitation still waiting for this account's own email to accept or
 * decline. Shared between the Workspace dashboard and the Workspaces hub, so
 * an invitation an Operator was just sent -- by anyone, into any workspace --
 * is discoverable the moment they next sign in, not only on a page they might
 * never think to open.
 */
export function PendingInvitationCard({
  invitation,
  busy,
  onAccept,
  onDecline,
}: {
  invitation: PendingInvitation;
  busy: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  return (
    <Card className="flex flex-col gap-3 border-brand bg-brand-subtle">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-surface text-brand">
          <Mail width={16} height={16} aria-hidden />
        </span>
        <div className="min-w-0">
          <Text variant="body" className="truncate font-medium">
            {invitation.workspace_name}
          </Text>
          <Text variant="caption" tone="secondary">
            Invited as {roleLabel[invitation.role] ?? invitation.role}
          </Text>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" disabled={busy} onClick={onAccept}>
          <Check width={14} height={14} aria-hidden />
          Accept
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={onDecline}>
          <X width={14} height={14} aria-hidden />
          Decline
        </Button>
      </div>
    </Card>
  );
}
