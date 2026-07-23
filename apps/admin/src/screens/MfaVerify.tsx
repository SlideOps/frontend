import { zodResolver } from '@hookform/resolvers/zod';
import { adminMfaVerify, ApiError } from '@slideops/api-client';
import { Button, Field } from '@slideops/design-system';
import { Guidance } from '@slideops/tooltips';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../components/AuthLayout';
import { codeSchema, type CodeValues } from '../auth-schemas';
import { useAuthStore } from '../store/auth';

/** Second step of Admin sign in. Verifies a 6 digit code against the challenge. */
export function MfaVerify() {
  const navigate = useNavigate();
  const location = useLocation();
  const signIn = useAuthStore((state) => state.signIn);
  const challenge = (location.state as { challenge?: string } | null)?.challenge;
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CodeValues>({ resolver: zodResolver(codeSchema) });

  if (!challenge) {
    return <Navigate to="/login" replace />;
  }

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const admin = await adminMfaVerify({ challenge, code: values.code });
      signIn(admin);
      navigate('/', { replace: true });
    } catch (error) {
      setFormError(
        error instanceof ApiError ? error.message : 'That code did not verify. Try again.',
      );
    }
  });

  return (
    <AuthLayout
      title="Enter your verification code"
      description="Enter the 6 digit code from your authenticator app to reach the control plane."
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
        <Button type="submit" className="mt-2 w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Verifying' : 'Verify and continue'}
        </Button>
      </form>
    </AuthLayout>
  );
}
