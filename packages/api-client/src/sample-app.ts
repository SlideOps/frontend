import { apiRequest, unwrap } from './http';

/*
 * The sample app surface. It hands back one ready to deploy preset, a tiny Hello
 * World that lives in a public repository so it needs no GitHub connection. An
 * Operator deploys it to confirm their whole path works end to end: the server
 * connection, the container runtime, the deploy pipeline, and public access. Like
 * the rest of the client every call is same origin and sends the session cookie.
 * Field names mirror the backend contract exactly so the wire shape and the type
 * never drift.
 */

/**
 * The preset to deploy. `runtime` is how it runs on the Node (a container),
 * `repository_url` and `branch` are the public source to clone and build, and
 * `container_port` is the port the workload listens on inside the container.
 */
export interface SampleApp {
  name: string;
  description: string;
  runtime: string;
  repository_url: string;
  branch: string;
  container_port: number;
}

/** Read the sample app preset the Operator can deploy to validate their setup. */
export function getSampleApp(signal?: AbortSignal): Promise<SampleApp> {
  return apiRequest<unknown>('/sample-app', { signal }).then((r) =>
    unwrap<SampleApp>(r, 'sample_app'),
  );
}
