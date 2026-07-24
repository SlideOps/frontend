import { zodResolver } from '@hookform/resolvers/zod';
import { ApiError, register as registerOperator } from '@slideops/api-client';
import { Button, Field, Text } from '@slideops/design-system';
import { Guidance } from '@slideops/tooltips';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../components/AuthLayout';
import { registerSchema, type RegisterValues } from '../auth-schemas';
import { useAuthStore } from '../store/auth';

/** Create a new Operator account. On success the Operator is signed in. */
export function Register() {
  const navigate = useNavigate();
  const status = useAuthStore((state) => state.status);
  const signIn = useAuthStore((state) => state.signIn);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({ resolver: zodResolver(registerSchema) });

  if (status === 'authenticated') {
    return <Navigate to="/app" replace />;
  }

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const operator = await registerOperator({
        email: values.email,
        password: values.password,
      });
      signIn(operator);
      navigate('/app', { replace: true });
    } catch (error) {
      setFormError(
        error instanceof ApiError ? error.message : 'Sign up did not complete. Try again.',
      );
    }
  });

  return (
    <AuthLayout
      title="Create your Operator account"
      description="Your Workspace, your Nodes, your Operations. Nothing here belongs to anyone else."
      footer={
        <Text variant="body-sm" tone="secondary">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-accent hover:text-brand">
            Sign in
          </Link>
        </Text>
      }
    >
      <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
        <Field
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          error={errors.email?.message}
          labelAdornment={<Guidance for="register.email" />}
          {...register('email')}
        />
        <Field
          label="Password"
          type="password"
          autoComplete="new-password"
          placeholder="At least 12 characters"
          error={errors.password?.message}
          labelAdornment={<Guidance for="register.password" />}
          {...register('password')}
        />
        <Field
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          placeholder="Re-enter your password"
          error={errors.confirmPassword?.message}
          labelAdornment={<Guidance for="register.confirm" />}
          {...register('confirmPassword')}
        />
        {formError ? (
          <p role="alert" className="text-sm text-danger">
            {formError}
          </p>
        ) : null}
        <Button type="submit" size="lg" className="mt-2 w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Creating your account' : 'Create account'}
        </Button>
      </form>
    </AuthLayout>
  );
}
