import { zodResolver } from '@hookform/resolvers/zod';
import { ApiError, login } from '@slideops/api-client';
import { Button, Field, Text } from '@slideops/design-system';
import { Guidance } from '@slideops/tooltips';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../components/AuthLayout';
import { GitHubSignIn } from '../components/GitHubSignIn';
import { loginSchema, type LoginValues } from '../auth-schemas';
import { useAuthStore } from '../store/auth';

/** Operator sign in, wired to the auth contract with react-hook-form and Zod. */
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
    return <Navigate to="/app" replace />;
  }

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const result = await login(values);
      if (result.kind === 'mfa_required') {
        navigate('/mfa', { state: { challenge: result.challenge } });
        return;
      }
      signIn(result.operator);
      navigate('/app', { replace: true });
    } catch (error) {
      setFormError(
        error instanceof ApiError ? error.message : 'Sign in did not complete. Try again.',
      );
    }
  });

  return (
    <AuthLayout
      title="Sign in to your Workspace"
      description="Welcome back, Operator. Your Nodes are waiting exactly as you left them."
      footer={
        <Text variant="body-sm" tone="secondary">
          New to SlideOps?{' '}
          <Link to="/register" className="font-medium text-accent hover:text-brand">
            Create an Operator account
          </Link>
        </Text>
      }
    >
      <GitHubSignIn label="Continue with GitHub" />

      <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
        <Field
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          error={errors.email?.message}
          labelAdornment={<Guidance for="login.email" />}
          {...register('email')}
        />
        <Field
          label="Password"
          type="password"
          autoComplete="current-password"
          placeholder="Your password"
          error={errors.password?.message}
          labelAdornment={<Guidance for="login.password" />}
          {...register('password')}
        />
        {formError ? (
          <p role="alert" className="text-sm text-danger">
            {formError}
          </p>
        ) : null}
        <Button type="submit" size="lg" className="mt-2 w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Signing in' : 'Sign in'}
        </Button>
      </form>
    </AuthLayout>
  );
}
