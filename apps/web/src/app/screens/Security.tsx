import { zodResolver } from '@hookform/resolvers/zod';
import {
  ApiError,
  apiBase,
  changePassword,
  mfaDisable,
  mfaEnable,
  mfaSetup,
  type MfaSetup,
  type PasswordChanged,
} from '@slideops/api-client';
import { Button, Field, Section, Text } from '@slideops/design-system';
import { KeyRound, ShieldCheck } from '@slideops/icons';
import { Guidance } from '@slideops/tooltips';
import { PageHeader } from '@slideops/ui';
import { useState } from 'react';
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
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Text variant="caption" tone="secondary">
            Setup secret
          </Text>
          <Guidance for="security.secret" />
        </div>
        <Text
          variant="code"
          className="select-all break-all rounded-md border border-border bg-subtle px-3 py-2"
        >
          {setup.secret}
        </Text>
        <Text variant="caption" tone="secondary" className="mt-2">
          Or add this URL to your authenticator
        </Text>
        <Text variant="code" className="select-all break-all text-ink-muted">
          {setup.otpauth_url}
        </Text>
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

/**
 * Where this deployment's API lives.
 *
 * An Operator running SlideOps on their own server had no way to find the URL
 * their own app was talking to, or the API reference, without asking somebody.
 * It is not a secret and it is not guessable from the outside, so it belongs on
 * a page rather than in a conversation.
 *
 * The base is read from the client itself, so it is always the address this
 * build actually calls rather than one written down and left to drift.
 */
function ApiDetails() {
  const base = apiBase();
  // The client uses a relative base when the API shares this origin, which is
  // the usual arrangement. Showing "/api/v1" would be true and useless, so it
  // is resolved against the page.
  const absolute = /^https?:\/\//i.test(base) ? base : new URL(base, window.location.origin).href;
  const docs = new URL('/docs', absolute).href;

  return (
    <div className="flex max-w-xl flex-col gap-3">
      <Text variant="body-sm" tone="secondary">
        This is the API your app is talking to, and the reference for it. Useful when you are wiring
        another client, or checking what a request actually returns.
      </Text>
      <div className="flex flex-col divide-y divide-border">
        <div className="flex flex-wrap items-center justify-between gap-2 py-2">
          <Text variant="body-sm" tone="secondary">
            API base
          </Text>
          <Text variant="code" className="select-all break-all">
            {absolute}
          </Text>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 py-2">
          <Text variant="body-sm" tone="secondary">
            API reference
          </Text>
          <a
            href={docs}
            target="_blank"
            rel="noreferrer"
            className="break-all font-mono text-sm text-brand underline underline-offset-2"
          >
            {docs}
          </a>
        </div>
      </div>
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

/** The Operator security settings: the account password, and two step verification. */
export function Security() {
  const operator = useAuthStore((state) => state.operator);
  const enabled = operator?.mfa_enabled ?? false;

  return (
    <OperatorShell active="security">
      <PageHeader
        title="Security"
        description="How you prove this account is yours: the password you sign in with, and a second step on top of it."
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
        <Section title="This deployment" flush>
          <ApiDetails />
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
