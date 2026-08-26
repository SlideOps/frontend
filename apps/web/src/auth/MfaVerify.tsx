import { zodResolver } from '@hookform/resolvers/zod';
import { ApiError, mfaVerify } from '@slideops/api-client';
import { Button, Field, Text } from '@slideops/design-system';
import { Guidance } from '@slideops/tooltips';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../components/AuthLayout';
import { codeSchema, type CodeValues } from '../auth-schemas';
import { useAuthStore } from '../store/auth';

/** Second step of sign in for Operators with MFA. Verifies a 6 digit code. */
export function MfaVerify() {
  const navigate = useNavigate();
  const location = useLocation();
  const signIn = useAuthStore((state) => state.signIn);
  const locationState = location.state as { challenge?: string; next?: string } | null;
  const challenge = locationState?.challenge;
  const next = locationState?.next ?? '/app';
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CodeValues>({ resolver: zodResolver(codeSchema) });

  // The challenge only exists after a login that asked for MFA. Without it,
  // send the Operator back to sign in rather than showing a dead form.
  if (!challenge) {
    return <Navigate to="/login" replace />;
  }

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const operator = await mfaVerify({ challenge, code: values.code });
      signIn(operator);
      navigate(next, { replace: true });
    } catch (error) {
      setFormError(
        error instanceof ApiError ? error.message : 'That code did not verify. Try again.',
      );
    }
  });

  return (
    <AuthLayout
      title="Enter your verification code"
      description="Open your authenticator app and enter the 6 digit code for SlideOps."
    >
      <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
        <Field
          label="Verification code"
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
        <Button type="submit" size="lg" className="mt-2 w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Verifying' : 'Verify and continue'}
        </Button>
        <Text variant="body-sm" tone="secondary" className="text-center">
          Lost your device? Contact your Workspace owner to recover access.
        </Text>
      </form>
    </AuthLayout>
  );
}
