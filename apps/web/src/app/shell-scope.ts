/*
 * What a Service's terminal is actually attached to.
 *
 * Only a container Service is entered inside its own container. A systemd
 * Service has no container, and neither does a compose Service: a stack is
 * several containers, so its shell lands on the server in the stack's own
 * directory, beside them rather than inside one.
 *
 * Both screens used to ask only whether the runtime was systemd, which left a
 * compose Service described as "inside this Service's own container" while the
 * shell was in fact on the host. That is the one wrong answer this labelling
 * exists to prevent: an Operator who believes they are contained will run
 * something destructive believing it cannot reach the server.
 *
 * The banner the server writes into the terminal is still the authority. This
 * is what the page says before the terminal opens, and it must not disagree
 * with it.
 */

/** A Service runtime, as the API reports it. */
export type ShellRuntime = string | undefined;

export interface ShellScope {
  /** A short noun phrase for where the shell lands. */
  label: string;
  /** A sentence saying what is reachable, and whether it is confined. */
  detail: string;
  /** Whether the shell is genuinely confined to the Service. */
  isolated: boolean;
}

const AUDIT_NOTE = 'Opening it is recorded in the audit trail.';

/** shellScopeFor describes where a terminal on this Service will land. */
export function shellScopeFor(runtime: ShellRuntime): ShellScope {
  if (runtime === 'container') {
    return {
      label: 'Inside this Service',
      detail: `A shell inside this Service's own container. ${AUDIT_NOTE}`,
      isolated: true,
    };
  }
  if (runtime === 'compose') {
    return {
      label: 'This Service, on the server',
      detail:
        'A shell on the server, in this stack’s own directory. A compose Service is several ' +
        'containers, so this is beside them rather than inside one. It is not confined to the ' +
        `Service. ${AUDIT_NOTE}`,
      isolated: false,
    };
  }
  // systemd, and anything a later release adds that is not a container. Claiming
  // isolation is the failure that matters, so the unknown case claims none.
  return {
    label: 'This Service, on the server',
    detail:
      'A shell on the server in this Service’s own directory. A Service that is not a container ' +
      `is not confined to itself, so this reaches the server. ${AUDIT_NOTE}`,
    isolated: false,
  };
}
