# API reference

Everything the SlideOps web app does, it does through a documented HTTP API. This page tells you where that reference lives, how a caller authenticates, and what to expect from the shapes it returns. It deliberately does not restate endpoint signatures: the generated reference is the authority on those, and a copy here would drift.

## Where the reference lives

The API serves its own interactive reference at `/docs` on the API host. Open it in a browser:

```
https://<your-api-host>/docs
```

It is a Swagger UI, generated from the API's own source, so it always describes the build that is actually running. Every endpoint is listed with its parameters, its request body, its response shapes, and the errors it can return.

The machine readable document behind it is available at:

```
https://<your-api-host>/docs/doc.json
```

`/swagger.json` redirects to the same document. The specification is OpenAPI in its Swagger 2.0 form, which most client generators accept directly.

The reference is public. It needs no session, because knowing which endpoints exist is not a secret and a caller has no session before signing in.

### Finding the endpoint you want

The reference groups operations by resource. The groups that exist match the vocabulary used throughout these docs, so if you know the concept you can find the endpoints:

| Group | What it covers |
| --- | --- |
| `auth` | Register, sign in, two step verification, the current Operator, password changes |
| `workspaces` | Listing Workspaces, switching the active one, team members, invitations |
| `projects` | Creating Projects and assigning Nodes to them |
| `nodes` | Connecting a Node, Discovery, metrics, shells, routes |
| `capabilities` | The Capability catalog and the compatibility matrix |
| `operations` | Creating an Operation, approving it, cancelling it, reading its record |
| `services` | Deploying, redeploying, lifecycle actions, configuration, logs, CI/CD |
| `automations` | Scheduled Operations |
| `marketplace` | Plugins available and installed |
| `domains`, `dns`, `ingress`, `network` | Hostnames, DNS providers, routing |
| `notifications`, `reports`, `search` | Reading what happened |
| `billing` | Tier, checkout, subscription, transactions |
| `admin` | Platform control plane, available only to an account with the admin role |

Some groups are only mounted when the deployment has the dependency they need. A deployment without DNS configured, for example, will not list `dns` endpoints at all.

## The base path

Every API endpoint lives under a version prefix:

```
/api/v1
```

So a full URL looks like `https://api.example.com/api/v1/services`.

Two paths sit outside that prefix, at the root of the API host, because they are about the server rather than about the API:

```
GET /healthz
GET /readyz
```

The generated reference lists these under the `/api/v1` prefix because of how the specification is assembled. The real paths are the unprefixed ones above. `/api/v1/version` is genuinely under the prefix.

## Authentication

Authentication is session based, and the session lives in a cookie.

### How it works

1. `POST /api/v1/auth/login` with an email and a password.
2. If the account has no two step verification, the response sets an `HttpOnly` cookie named `so_session` and returns the Operator. You are signed in.
3. If the account has two step verification enabled, no cookie is set. The response comes back with `mfa_required` and a single use `challenge`. Send that challenge and the six digit code to `POST /api/v1/auth/mfa/verify`, and that call sets the cookie.
4. Every subsequent request carries the cookie. Nothing else is needed.

The challenge is single use and expires after five minutes. The session itself lasts thirty days and is rolled forward every time it is used, so an account in daily use is never signed out by expiry. There is no refresh endpoint, and none is needed.

`POST /api/v1/auth/logout` ends the session on the server, not only in the browser.

### What the cookie is

`so_session` is an opaque token. It is `HttpOnly`, so page scripts cannot read it, and it is marked `Secure` in production. It is not a JWT and carries no claims: the server holds the session and looks it up on every request.

### There are no API keys

SlideOps issues no personal access tokens and no API keys. A script that calls the API signs in the way the browser does and keeps the cookie:

```bash
# Sign in once, keeping the session cookie in a jar.
curl -c jar.txt -X POST https://api.example.com/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","password":"..."}'

# Then send the jar with every call.
curl -b jar.txt https://api.example.com/api/v1/services
```

This is a deliberate choice rather than a gap. A long lived API key is a credential that can reach an Operator's whole fleet and cannot be tied to a sign in, and adding one is a decision about the security of your infrastructure, not a convenience.

There is exactly one bearer token in the system, and it is narrow on purpose: a Service can issue a **deploy hook token** so an external CI system can trigger that one Service's deploy. It authenticates two endpoints and nothing else. See [Deploying](/docs/build/deploying) for what it does.

### Roles

Two role systems apply, and they are separate.

- **Workspace role.** Owner, Admin, Member, or Viewer, held per Workspace. A Viewer is refused every write: any non read request comes back `403` with the code `read_only_member`.
- **Account role.** Operator or admin. The admin role grants the platform control plane under `/api/v1/admin`, and nothing else. In production an admin without two step verification is refused those routes.

## Response shapes

Every response is JSON, with `Content-Type: application/json; charset=utf-8`.

### Errors

Every failure uses one envelope, everywhere:

```json
{
  "error": {
    "code": "not_found",
    "message": "the node was not found"
  }
}
```

`code` is stable snake case and is what a client should branch on. `message` is written for a person to read and may be reworded between releases, so matching on its text will break quietly.

Status codes carry their usual meanings, with two worth calling out:

| Status | Meaning |
| --- | --- |
| `400` | The request body or a parameter was not valid |
| `401` | No session, or the session has expired |
| `403` | Not allowed: a Viewer writing, an admin route, or a tier quota |
| `404` | No such resource **for you**. Someone else's resource returns `404`, never `403`, so the API never confirms that a resource you cannot reach exists |
| `409` | A conflict, such as a name already taken or a Service already removed |
| `429` | Rate limited |
| `500` | Something went wrong inside the API |
| `502` | A server you own could not be reached |
| `503` | A platform hold is engaged and mutating calls are paused |

Codes you are likely to meet in normal use include `unauthorized`, `invalid_credentials`, `invalid_request`, `forbidden`, `read_only_member`, `not_found`, `quota_exceeded`, `rate_limited`, and `config_changed`.

### Rate limiting

Only sign in is rate limited: ten attempts per email and client IP within a fifteen minute window, after which the API answers `429` with the code `rate_limited`. No other endpoint is throttled, and no `X-RateLimit-*` or `Retry-After` headers are emitted.

## Realtime

Live output is delivered over WebSockets. There are four:

| Path | What it carries |
| --- | --- |
| `GET /api/v1/stream` | Every Operation step, deploy line, and status change in the active Workspace. Add `?operation_id=<id>` to narrow it to one Operation |
| `GET /api/v1/services/{id}/logs/stream` | One Service's live output, with a burst of recent history on connect |
| `GET /api/v1/nodes/{id}/shell` | An interactive terminal on the whole Node |
| `GET /api/v1/services/{id}/shell` | An interactive shell inside that Service's own container |

All four authenticate with the same `so_session` cookie, carried on the upgrade request. There is no token in the query string.

Two details matter if you are writing a client:

- **These are WebSockets, not Server-Sent Events.** Some annotations in the generated reference describe `/stream` as SSE. That description is wrong; `EventSource` will not connect. Open it with `new WebSocket(...)`.
- **A shell carries two frame types.** Keystrokes and output travel as binary frames and pass through untouched. Control messages, such as a terminal resize, travel as text frames carrying JSON. The split means a control message can never be mistaken for terminal input.

A request to a shell or log stream path that is not a WebSocket upgrade is answered `426 Upgrade Required` with the code `upgrade_required`, rather than being left hanging. A refusal that happens after the upgrade, such as a Service that is not running, arrives as an `error` frame inside the socket and then a close, because a browser cannot read the status of a failed handshake.

## Cross origin use

By default the app and the API share one origin and no CORS headers are emitted at all.

If you serve the app from a different origin, the API must name that origin in its `CORS_ALLOWED_ORIGINS` configuration. The allowlist is exact match, never a wildcard, because the session cookie is a credential. Configuring it also switches the session cookie to `SameSite=None; Secure`, which means both sides must be served over HTTPS for a browser to send it at all.

## What the API does not decide

The API is a transport. The rules it enforces come from the domain: a Capability still runs its whole lifecycle, approval is still required before an Operation executes, and verification still follows execution. Calling `POST /api/v1/operations` does not run anything; it creates an Operation that reaches `awaiting_approval` with a plan attached, and `POST /api/v1/operations/{id}/approve` is what allows it to run. See [How an Operation works](/docs/start/how-an-operation-works) for what happens between those two calls.
