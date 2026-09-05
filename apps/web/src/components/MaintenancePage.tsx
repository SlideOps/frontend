import { Button, Text } from '@slideops/design-system';
import { Construction } from '@slideops/icons';
import { useNotificationsStore } from '../app/notifications/store';
import { useAuthStore } from '../store/auth';
import { useWorkspaceStore } from '../store/workspace';

/**
 * Shown to a signed-in, non-admin Operator in place of the app while planned
 * maintenance is on. An Admin never sees this: the control plane and the
 * ability to turn maintenance back off both have to stay reachable by the
 * one account that can act on it.
 */
export function MaintenancePage() {
  const signOut = useAuthStore((state) => state.signOut);
  const resetWorkspaces = useWorkspaceStore((state) => state.reset);
  const clearNotifications = useNotificationsStore((state) => state.clear);

  const onSignOut = async () => {
    await signOut();
    resetWorkspaces();
    clearNotifications();
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-app px-6 text-center">
      <Construction width={40} height={40} className="text-brand" aria-hidden />
      <Text variant="h2">SlideOps is in maintenance</Text>
      <Text variant="body-sm" tone="secondary" className="max-w-md">
        We are doing planned work on the platform. Your existing running Services are unaffected
        and keep serving traffic exactly as they were. This page will go away on its own once
        maintenance ends.
      </Text>
      <Button variant="ghost" size="sm" className="mt-2" onClick={() => void onSignOut()}>
        Sign out
      </Button>
    </div>
  );
}
