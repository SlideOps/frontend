import { Button, Card, Field, Text } from '@slideops/design-system';
import { Logo, Lock } from '@slideops/icons';
import { Guidance } from '@slideops/tooltips';
import { type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

/** Placeholder Admin sign in. Separate, stricter surface than the Operator app. */
export function Login() {
  const navigate = useNavigate();

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    navigate('/');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-app px-4 py-12 text-ink">
      <Card className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <Logo size={30} />
          <span className="mt-5 inline-flex items-center gap-2 rounded-pill bg-subtle px-3 py-1 text-xs font-medium uppercase tracking-wide text-brand">
            <Lock width={13} height={13} aria-hidden />
            Control plane
          </span>
          <Text variant="h3" className="mt-4">
            Admin sign in
          </Text>
        </div>
        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
          <Field
            label="Email"
            type="email"
            name="email"
            autoComplete="email"
            required
            labelAdornment={<Guidance for="login.email" />}
          />
          <Field
            label="Password"
            type="password"
            name="password"
            autoComplete="current-password"
            required
            labelAdornment={<Guidance for="login.password" />}
          />
          <Button type="submit" className="mt-2 w-full">
            Sign in
          </Button>
        </form>
      </Card>
    </div>
  );
}
