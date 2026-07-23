import { zodResolver } from '@hookform/resolvers/zod';
import {
  ApiError,
  mfaDisable,
  mfaEnable,
  mfaSetup,
  type MfaSetup,
} from '@slideops/api-client';
import { Button, Card, Field, Text } from '@slideops/design-system';
import { KeyRound, ShieldCheck } from '@slideops/icons';
import { Guidance } from '@slideops/tooltips';
import { PageHeader } from '@slideops/ui';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  codeSchema,
  passwordConfirmSchema,
  type CodeValues,
  type PasswordConfirmValues,
} from '../auth-schemas';
import { OperatorShell } from '../components/OperatorShell';
import { useAuthStore } from '../store/auth';

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

/** The Operator security settings: two step verification setup and removal. */
export function Security() {
  const operator = useAuthStore((state) => state.operator);
  const enabled = operator?.mfa_enabled ?? false;

  return (
    <OperatorShell active="security">
      <PageHeader
        title="Security"
        description="Protect your Workspace with two step verification. It adds a short code from an authenticator app on top of your password."
        guidanceKey="security.mfa"
      />

      <Card className="max-w-xl">
        <div className="mb-4 flex items-start gap-3">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-subtle text-brand">
            {enabled ? (
              <ShieldCheck width={18} height={18} aria-hidden />
            ) : (
              <KeyRound width={18} height={18} aria-hidden />
            )}
          </span>
          <div>
            <Text variant="h4">Two step verification</Text>
            <Text variant="body-sm" tone="secondary" className="mt-1">
              {enabled ? 'On for this account.' : 'Off for this account.'}
            </Text>
          </div>
        </div>
        {enabled ? <DisableMfa /> : <EnableMfa />}
      </Card>
    </OperatorShell>
  );
}
