import {
  ApiError,
  createOperation,
  revealNodeCredential,
  type Node,
  type ServerUser,
} from '@slideops/api-client';
import { Button, Text } from '@slideops/design-system';
import { Download, KeyRound, Lock, Trash2, Unlock, X } from '@slideops/icons';
import { useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RevealValue } from './RevealValue';

/*
 * The full details of one server account, opened from its name on the server
 * page. It shows how to reach the account (the address, port, and username) and,
 * for the account SlideOps connects with, the stored credential itself so the
 * Operator can reveal, copy, or download it and use it in another tool. Other
 * accounts carry no stored credential, which the modal states plainly rather than
 * implying SlideOps holds a key it never had.
 */

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 border-b border-border py-2 last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <Text variant="caption" tone="secondary">
        {label}
      </Text>
      <div className="min-w-0 sm:max-w-[60%]">
        <RevealValue value={value} label={label} sensitive={false} />
      </div>
    </div>
  );
}

/**
 * What can be done to this account, from the page you are already looking at.
 *
 * The modal showed an account and gave no way to act on it, so disabling one
 * meant knowing which Capability to find and typing the username again. The
 * actions belong where the account is.
 *
 * Which actions appear depends on the account. The connection account offers
 * none: locking or removing the account SlideOps signs in with would end its own
 * access to the server. A system account other than root offers none either.
 * root can be disabled but never removed, because the account has to exist.
 */
function AccountActions({
  account,
  node,
  onDone,
}: {
  account: ServerUser;
  node: Node;
  onDone: () => void;
}) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState<null | 'disable' | 'enable' | 'remove'>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const run = async (kind: 'disable' | 'enable' | 'remove', capabilityKey: string) => {
    setBusy(kind);
    setFailure(null);
    try {
      const operation = await createOperation({
        node_id: node.id,
        capability_key: capabilityKey,
        parameters: { username: account.username },
      });
      onDone();
      // Straight to the Operation, because none of this has happened yet: it is
      // planned and waiting for approval like every other change.
      navigate(`/app/operations/${operation.id}`);
    } catch (error) {
      setFailure(
        error instanceof ApiError ? error.message : 'That could not be started. Try again.',
      );
      setBusy(null);
    }
  };

  if (account.connection) {
    return (
      <div className="mt-6 border-t border-border pt-4">
        <Text variant="body-sm" tone="secondary">
          This is the account SlideOps connects with. It cannot be disabled or removed from here,
          because doing so would end SlideOps' own access to this server. Switch the connection to
          another account first.
        </Text>
      </div>
    );
  }
  if (account.system && account.username !== 'root') {
    return (
      <div className="mt-6 border-t border-border pt-4">
        <Text variant="body-sm" tone="secondary">
          This is a system account. It belongs to the operating system rather than to a person, and
          changing it is left to the server.
        </Text>
      </div>
    );
  }

  return (
    <div className="mt-6 border-t border-border pt-4">
      <Text variant="body-sm" className="mb-1 font-medium">
        Actions
      </Text>
      <Text variant="body-sm" tone="secondary" className="mb-3 block">
        {account.disabled
          ? 'This account is disabled. Enabling it restores the password it had before.'
          : 'Disabling locks the account without deleting anything, so it can be opened again later.'}
      </Text>

      <div className="flex flex-wrap items-center gap-2">
        {account.disabled ? (
          <Button
            size="sm"
            variant="secondary"
            disabled={busy !== null}
            onClick={() => run('enable', 'enable-server-user')}
          >
            <Unlock width={15} height={15} aria-hidden />
            {busy === 'enable' ? 'Starting' : 'Enable this account'}
          </Button>
        ) : (
          <Button
            size="sm"
            variant="secondary"
            disabled={busy !== null}
            onClick={() => run('disable', 'disable-server-user')}
          >
            <Lock width={15} height={15} aria-hidden />
            {busy === 'disable' ? 'Starting' : 'Disable this account'}
          </Button>
        )}

        {/* root has to exist, so it is never offered for removal. Disabling it is
            the whole reason that Capability exists. */}
        {account.username === 'root' ? null : confirmRemove ? (
          <>
            <Button size="sm" variant="ghost" onClick={() => setConfirmRemove(false)}>
              Keep it
            </Button>
            <Button
              size="sm"
              variant="danger"
              disabled={busy !== null}
              onClick={() => run('remove', 'remove-server-user')}
            >
              {busy === 'remove' ? 'Starting' : 'Remove permanently'}
            </Button>
          </>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => setConfirmRemove(true)}>
            <Trash2 width={15} height={15} aria-hidden />
            Remove this account
          </Button>
        )}
      </div>

      {confirmRemove && account.username !== 'root' ? (
        <Text variant="body-sm" tone="secondary" className="mt-2 block">
          Removing deletes the account and its home directory, and cannot be undone. Disabling is
          reversible and is usually what you want.
        </Text>
      ) : null}
      {failure ? (
        <p role="alert" className="mt-2 text-sm text-danger">
          {failure}
        </p>
      ) : null}
    </div>
  );
}

export function ServerAccountModal({
  open,
  account,
  node,
  onClose,
}: {
  open: boolean;
  account: ServerUser | null;
  node: Node;
  onClose: () => void;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    setError(null);
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === 'Tab') {
        const panel = panelRef.current;
        if (!panel) {
          return;
        }
        const focusable = panel.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input, [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) {
          return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocused.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open || !account) {
    return null;
  }

  // The stored credential belongs to the account SlideOps connects as, whose auth
  // kind and secret are the Node's. Any other account is managed on the server and
  // SlideOps holds nothing for it.
  const isConnectionAccount = account.connection;
  const usesPrivateKey = node.auth_kind === 'private_key';

  const downloadKey = async () => {
    setDownloading(true);
    setError(null);
    try {
      const credential = await revealNodeCredential(node.id);
      const extension = credential.auth_kind === 'private_key' ? 'pem' : 'txt';
      const blob = new Blob([credential.secret], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${node.name}-${account.username}.${extension}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'The credential could not be read. Try again.',
      );
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(43, 28, 23, 0.55)' }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-lg rounded-lg border border-border bg-surface p-6 shadow-lg"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-subtle text-brand">
              <KeyRound width={18} height={18} aria-hidden />
            </span>
            <div className="min-w-0">
              <Text id={titleId} variant="h3">
                {account.username}
              </Text>
              <div className="mt-0.5 flex flex-wrap items-center gap-2">
                <Text variant="caption" tone="secondary">
                  {account.access_level === 'admin' ? 'Administrator' : 'Limited account'}
                </Text>
                {account.connection ? (
                  <span className="inline-flex items-center gap-1 text-xs text-success">
                    <Lock width={12} height={12} aria-hidden />
                    Connection account
                  </span>
                ) : null}
                {account.system ? <span className="text-xs text-ink-muted">System</span> : null}
              </div>
            </div>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-ink-muted transition-colors duration-fast ease-standard hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            <X width={18} height={18} aria-hidden />
          </button>
        </div>

        <div className="rounded-md border border-border bg-subtle px-4">
          <DetailRow label="Server" value={node.name} />
          <DetailRow label="Address" value={node.address} />
          <DetailRow label="Port" value={String(node.port)} />
          {node.hostname ? <DetailRow label="Hostname" value={node.hostname} /> : null}
          <DetailRow label="Account" value={account.username} />
        </div>

        <div className="mt-5">
          <div className="mb-2 flex items-center gap-2">
            <Lock width={15} height={15} className="text-brand" aria-hidden />
            <Text variant="body-sm" className="font-medium">
              Credential
            </Text>
          </div>
          {isConnectionAccount ? (
            usesPrivateKey ? (
              <div className="flex flex-col gap-3">
                <Text variant="body-sm" tone="secondary">
                  SlideOps connects to this server as {account.username} with a private key you
                  supplied. Download it to use this account in another SSH client, then keep it
                  safe.
                </Text>
                <div>
                  <Button onClick={downloadKey} disabled={downloading} aria-busy={downloading}>
                    <Download width={15} height={15} aria-hidden />
                    {downloading ? 'Preparing' : 'Download private key'}
                  </Button>
                </div>
                {error ? (
                  <p role="alert" className="text-sm text-danger">
                    {error}
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <Text variant="body-sm" tone="secondary">
                  SlideOps connects to this server as {account.username} with a password you
                  supplied. Reveal it to copy it into another tool.
                </Text>
                <RevealValue
                  label="Password"
                  sensitive
                  onReveal={() => revealNodeCredential(node.id).then((c) => c.secret)}
                />
              </div>
            )
          ) : (
            <Text variant="body-sm" tone="secondary">
              SlideOps does not hold a credential for this account. It is managed on the server; use
              the key or password you set for it there.
            </Text>
          )}
        </div>

        <AccountActions account={account} node={node} onDone={onClose} />

        <div className="mt-6 flex justify-end">
          <Button variant="ghost" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
