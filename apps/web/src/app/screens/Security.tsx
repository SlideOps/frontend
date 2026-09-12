import { zodResolver } from '@hookform/resolvers/zod';
import {
  ApiError,
  changePassword,
  mfaDisable,
  mfaEnable,
  mfaSetup,
  type MfaSetup,
  type Operator,
  type PasswordChanged,
  type WorkspaceRole,
} from '@slideops/api-client';
import { Button, Field, Section, Text } from '@slideops/design-system';
import { KeyRound, ShieldCheck } from '@slideops/icons';
import { Guidance } from '@slideops/tooltips';
import { PageHeader } from '@slideops/ui';
import { useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import {
  changePasswordSchema,
  codeSchema,
  passwordConfirmSchema,
  type ChangePasswordValues,
  type CodeValues,
  type PasswordConfirmValues,
} from '../../auth-schemas';
import { OperatorShell } from '../components/OperatorShell';
import { isAdmin, useAuthStore } from '../../store/auth';
import { useWorkspaceStore } from '../../store/workspace';
import { CopyButton } from '../components/CopyButton';

/** Enable MFA: start setup, show the secret, then confirm a code. */
function EnableMfa() {
  const signIn = useAuthStore((state) => state.signIn);
  const [setup, setSetup] = useState<MfaSetup | null>(null);
  const [starting, setStarting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CodeValues>({ resolver: zodResolver(codeSchema) });

  const startSetup = async () => {
    setFormError(null);
    setStarting(true);
    try {
      setSetup(await mfaSetup());
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Setup did not start. Try again.');
    } finally {
      setStarting(false);
    }
  };

  const onConfirm = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const operator = await mfaEnable({ code: values.code });
      signIn(operator);
      reset();
      setSetup(null);
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'That code did not verify.');
    }
  });

  if (!setup) {
    return (
      <div className="flex flex-col gap-4">
        <Text variant="body-sm" tone="secondary">
          Add a second step to sign in. You will use an authenticator app to generate a short code.
        </Text>
        <Button onClick={startSetup} disabled={starting}>
          {starting ? 'Starting' : 'Begin setup'}
        </Button>
        {formError ? (
          <p role="alert" className="text-sm text-danger">
            {formError}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Scanning first, because it is what almost everybody will do and the one
          step that cannot be got wrong by mistyping. */}
      {setup.qr_code ? (
        <div className="flex flex-col items-center gap-3 rounded-md border border-border bg-subtle p-4 sm:flex-row sm:items-start sm:gap-5">
          <img
            src={setup.qr_code}
            alt="QR code for your authenticator app"
            width={180}
            height={180}
            // White behind it whatever the theme: a dark background under a QR
            // inverts it and many scanners will not read it.
            className="shrink-0 rounded-md bg-white p-2"
          />
          <div className="min-w-0 text-center sm:text-left">
            <Text variant="body-sm" className="font-medium">
              Scan this with your authenticator
            </Text>
            <Text variant="body-sm" tone="secondary" className="mt-1 block">
              Google Authenticator, 1Password, Authy, or whichever you use. It will show a six digit
              code that changes every thirty seconds.
            </Text>
            <Text variant="caption" tone="secondary" className="mt-2 block">
              On a phone and cannot scan your own screen? Use the setup key below instead.
            </Text>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Text variant="caption" tone="secondary">
            {setup.qr_code ? 'Or enter this setup key by hand' : 'Setup key'}
          </Text>
          <Guidance for="security.secret" />
          <CopyButton value={setup.secret} label="the setup key" className="ml-auto" />
        </div>
        <Text
          variant="code"
          className="select-all break-all rounded-md border border-border bg-subtle px-3 py-2"
        >
          {setup.secret}
        </Text>

        <details className="mt-1">
          <summary className="cursor-pointer text-xs text-ink-muted hover:text-ink">
            The full provisioning URL, if your app takes one
          </summary>
          <div className="mt-2 flex items-start gap-2">
            <Text variant="code" className="min-w-0 select-all break-all text-ink-muted">
              {setup.otpauth_url}
            </Text>
            <CopyButton value={setup.otpauth_url} label="the provisioning URL" />
          </div>
        </details>
      </div>
      <form className="flex flex-col gap-4" onSubmit={onConfirm} noValidate>
        <Field
          label="Confirm with a code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="123456"
          error={errors.code?.message}
          labelAdornment={<Guidance for="mfa.code" />}
          {...register('code')}
        />
        {formError ? (
          <p role="alert" className="text-sm text-danger">
            {formError}
          </p>
        ) : null}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Enabling' : 'Enable protection'}
        </Button>
      </form>
    </div>
  );
}

/** Disable MFA: confirm with the account password. */
function DisableMfa() {
  const signIn = useAuthStore((state) => state.signIn);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PasswordConfirmValues>({ resolver: zodResolver(passwordConfirmSchema) });

  const onDisable = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const operator = await mfaDisable({ password: values.password });
      signIn(operator);
      reset();
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Could not turn this off.');
    }
  });

  return (
    <form className="flex flex-col gap-4" onSubmit={onDisable} noValidate>
      <Text variant="body-sm" tone="secondary">
        Protection is on. To turn it off, confirm your password.
      </Text>
      <Field
        label="Password"
        type="password"
        autoComplete="current-password"
        placeholder="Your password"
        error={errors.password?.message}
        labelAdornment={<Guidance for="security.disable" />}
        {...register('password')}
      />
      {formError ? (
        <p role="alert" className="text-sm text-danger">
          {formError}
        </p>
      ) : null}
      <Button type="submit" variant="danger" disabled={isSubmitting}>
        {isSubmitting ? 'Turning off' : 'Turn off protection'}
      </Button>
    </form>
  );
}

const roleLabel: Record<WorkspaceRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
  viewer: 'Viewer',
};

const planLabel: Record<NonNullable<Operator['tier']>, string> = {
  free: 'Free',
  starter: 'Starter',
  pro: 'Pro',
  enterprise: 'Enterprise',
};

/** A date as a person reads it, or the value as given when it is not a date. */
function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'long' }).format(date);
}

/** How this account signs in, in words. */
function signInMethods(operator: Operator): string {
  const methods = [
    operator.has_password ? 'Password' : null,
    operator.github_login ? `GitHub (@${operator.github_login})` : null,
  ].filter((method): method is string => method !== null);
  return methods.length > 0 ? methods.join(' and ') : 'GitHub';
}

function ProfileRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 py-3 sm:grid-cols-[11rem_1fr] sm:items-center sm:gap-3">
      <dt className="text-xs font-medium text-ink-muted">{label}</dt>
      <dd className="min-w-0 text-sm text-ink">{children}</dd>
    </div>
  );
}

/**
 * The signed-in Operator's own account: who they are to SlideOps, how they
 * sign in, which plan the account is on, and every Workspace they can act in
 * with their role in each. It reads the account itself, never the Workspace
 * currently switched into, so a Member working in somebody else's Workspace
 * still sees their own details here.
 */
function Profile() {
  const operator = useAuthStore((state) => state.operator);
  const workspaces = useWorkspaceStore((state) => state.workspaces);
  if (!operator) return null;

  const access =
    operator.role === 'admin'
      ? 'Operator, with access to the admin control plane'
      : 'Operator';

  return (
    <div className="flex max-w-2xl flex-col gap-5">
      <div className="flex items-center gap-4">
        <span
          aria-hidden
          className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-pill bg-subtle text-lg font-semibold uppercase text-ink"
        >
          {operator.email.charAt(0)}
        </span>
        <div className="min-w-0">
          <Text variant="h4" className="truncate">
            {operator.email}
          </Text>
          <Text variant="body-sm" tone="secondary">
            {access}
          </Text>
        </div>
      </div>

      <dl className="flex flex-col divide-y divide-border rounded-md border border-border px-4">
        <ProfileRow label="Email">
          <span className="flex min-w-0 items-center gap-2">
            <span className="break-all">{operator.email}</span>
            <CopyButton value={operator.email} label="your email" />
          </span>
        </ProfileRow>
        <ProfileRow label="Account ID">
          <span className="flex min-w-0 items-center gap-2">
            <Text variant="code" className="break-all">
              {operator.id}
            </Text>
            <CopyButton value={operator.id} label="your account ID" />
          </span>
        </ProfileRow>
        <ProfileRow label="Access">{access}</ProfileRow>
        {operator.tier ? (
          <ProfileRow label="Plan">{planLabel[operator.tier] ?? operator.tier}</ProfileRow>
        ) : null}
        <ProfileRow label="Signs in with">{signInMethods(operator)}</ProfileRow>
        <ProfileRow label="Two step verification">
          {operator.mfa_enabled ? (
            <span className="text-success">On</span>
          ) : (
            <span className="text-ink-muted">Off</span>
          )}
        </ProfileRow>
        <ProfileRow label="Member since">{formatDate(operator.created_at)}</ProfileRow>
        {workspaces.length > 0 ? (
          <ProfileRow label="Workspaces">
            <ul className="flex flex-col gap-1.5">
              {workspaces.map((workspace) => (
                <li key={workspace.id} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-medium">{workspace.name}</span>
                  <span className="text-ink-muted">{roleLabel[workspace.role] ?? workspace.role}</span>
                  {workspace.active ? (
                    <span className="rounded-pill bg-subtle px-2 py-0.5 text-xs font-medium text-ink">
                      Active now
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </ProfileRow>
        ) : null}
      </dl>
    </div>
  );
}

/**
 * Change the account password.
 *
 * The current password is asked for because a signed-in session is not proof of
 * identity on its own: sessions outlive the moment they were created, so a
 * borrowed laptop must not be enough to take an account over. That is worth
 * saying on screen, since being asked for a password you have just typed to get
 * here otherwise reads as the form being awkward.
 *
 * An account that signs in through GitHub has no password, so this offers
 * nothing to change and says why.
 */
function ChangePassword() {
  const operator = useAuthStore((state) => state.operator);
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState<PasswordChanged | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordValues>({ resolver: zodResolver(changePasswordSchema) });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    setDone(null);
    try {
      setDone(
        await changePassword({
          current_password: values.currentPassword,
          new_password: values.newPassword,
        }),
      );
      reset();
    } catch (error) {
      setFormError(
        error instanceof ApiError
          ? error.message
          : 'Your password could not be changed. Try again.',
      );
    }
  });

  if (operator?.has_password === false) {
    return (
      <Text variant="body-sm" tone="secondary">
        You sign in through GitHub, so this account has no password to change. Your GitHub account
        controls access.
      </Text>
    );
  }

  return (
    <form className="flex max-w-xl flex-col gap-4" onSubmit={onSubmit} noValidate>
      <Text variant="body-sm" tone="secondary">
        Confirm the password you use now, then choose a new one. Being signed in is not enough on
        its own, which is what stops someone on a machine you left open from taking the account.
      </Text>

      <Field
        label="Current password"
        type="password"
        autoComplete="current-password"
        error={errors.currentPassword?.message}
        {...register('currentPassword')}
      />
      <Field
        label="New password"
        type="password"
        autoComplete="new-password"
        hint="At least 12 characters. Length protects an account better than punctuation does."
        error={errors.newPassword?.message}
        {...register('newPassword')}
      />
      <Field
        label="Confirm new password"
        type="password"
        autoComplete="new-password"
        error={errors.confirmPassword?.message}
        {...register('confirmPassword')}
      />

      {formError ? (
        <p role="alert" className="text-sm text-danger">
          {formError}
        </p>
      ) : null}
      {done ? (
        <p role="status" className="text-sm text-success">
          {/* The count is the point: it says in plain numbers that anyone else
              holding the old password has been signed out. */}
          Your password has been changed.{' '}
          {done.sessions_ended > 0
            ? `${done.sessions_ended} other ${done.sessions_ended === 1 ? 'session was' : 'sessions were'} signed out. You are still signed in here.`
            : 'There were no other sessions to sign out.'}
        </p>
      ) : null}

      <div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Changing your password' : 'Change password'}
        </Button>
      </div>
    </form>
  );
}

/** The Operator's own account: their profile, the password, and two step verification. */
export function Security() {
  const operator = useAuthStore((state) => state.operator);
  const enabled = operator?.mfa_enabled ?? false;

  return (
    <OperatorShell active="security">
      <PageHeader
        title="Profile and security"
        description="Who this account is, and how you prove it is yours: the password you sign in with, and a second step on top of it."
        guidanceKey="security.mfa"
      />

      {/* An admin who came here because the control plane turned them away needs
          to land on the reason, not scroll for it. */}
      {isAdmin(operator) && !enabled ? (
        <div
          role="status"
          className="mb-6 flex items-start gap-3 rounded-md border border-brand bg-subtle px-4 py-3"
        >
          <ShieldCheck width={18} height={18} className="mt-0.5 shrink-0 text-brand" aria-hidden />
          <div>
            <Text variant="body-sm" className="font-medium">
              The admin area needs this turned on
            </Text>
            <Text variant="body-sm" tone="secondary" className="mt-1 block">
              Two step verification is below. Turn it on and the control plane opens.
            </Text>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-8">
        <Section title="Profile" flush>
          <Profile />
        </Section>

        <Section title="Password">
          <ChangePassword />
        </Section>

        <Section
          title="Two step verification"
          description={
            enabled
              ? 'On for this account. Signing in asks for a code from your authenticator app as well as your password.'
              : 'Off for this account. Turning it on adds a short code from an authenticator app on top of your password.'
          }
          adornment={
            enabled ? (
              <ShieldCheck width={16} height={16} className="text-success" aria-hidden />
            ) : (
              <KeyRound width={16} height={16} className="text-ink-muted" aria-hidden />
            )
          }
        >
          <div className="max-w-xl">{enabled ? <DisableMfa /> : <EnableMfa />}</div>
        </Section>
      </div>
    </OperatorShell>
  );
}
