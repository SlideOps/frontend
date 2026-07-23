import { zodResolver } from '@hookform/resolvers/zod';
import { adminLogin, ApiError } from '@slideops/api-client';
import { Button, Field, Text } from '@slideops/design-system';
import { Guidance } from '@slideops/tooltips';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../components/AuthLayout';
import { loginSchema, type LoginValues } from '../auth-schemas';
import { useAuthStore } from '../store/auth';

/** Admin sign in. Separate, stricter surface than the Operator app, same MFA flow. */
export function Login() {
  const navigate = useNavigate();
  const status = useAuthStore((state) => state.status);
  const signIn = useAuthStore((state) => state.signIn);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });

  if (status === 'authenticated') {
    return <Navigate to="/" replace />;
  }

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const result = await adminLogin(values);
      if (result.kind === 'mfa_required') {
        navigate('/mfa', { state: { challenge: result.challenge } });
        return;
      }
      signIn(result.admin);
      navigate('/', { replace: true });
    } catch (error) {
      setFormError(
        error instanceof ApiError ? error.message : 'Sign in did not complete. Try again.',
      );
    }
  });

  return (
    <AuthLayout title="Admin sign in">
      <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
        <Field
          label="Email"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          labelAdornment={<Guidance for="login.email" />}
          {...register('email')}
        />
        <Field
          label="Password"
          type="password"
          autoComplete="current-password"
          error={errors.password?.message}
          labelAdornment={<Guidance for="login.password" />}
          {...register('password')}
        />
        {formError ? (
          <p role="alert" className="text-sm text-danger">
            {formError}
          </p>
        ) : null}
        <Button type="submit" className="mt-2 w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Signing in' : 'Sign in'}
        </Button>
      </form>
      <Text variant="body-sm" tone="secondary" className="mt-6 text-center">
        Admin accounts are provisioned by the platform. There is no self sign up here.
      </Text>
    </AuthLayout>
  );
}
