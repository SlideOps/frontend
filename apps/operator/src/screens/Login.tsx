import { Button, Card, Field, Text } from '@slideops/design-system';
import { Logo } from '@slideops/icons';
import { Guidance } from '@slideops/tooltips';
import { type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

/** Placeholder Operator sign in. Wires the layout and guidance, not real auth yet. */
export function Login() {
  const navigate = useNavigate();

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    navigate('/');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-app px-4 py-12 text-ink">
      <Card raised className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <Logo size={34} />
          <Text variant="h2" className="mt-6">
            Sign in to your Workspace
          </Text>
          <Text variant="body-sm" tone="secondary" className="mt-2">
            Welcome back, Operator. Your Nodes are waiting exactly as you left them.
          </Text>
        </div>
        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
          <Field
            label="Email"
            type="email"
            name="email"
            autoComplete="email"
            placeholder="you@example.com"
            required
            labelAdornment={<Guidance for="login.email" />}
          />
          <Field
            label="Password"
            type="password"
            name="password"
            autoComplete="current-password"
            placeholder="Your password"
            required
            labelAdornment={<Guidance for="login.password" />}
          />
          <Button type="submit" size="lg" className="mt-2 w-full">
            Sign in
          </Button>
        </form>
      </Card>
    </div>
  );
}
