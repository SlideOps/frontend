# SlideOps Frontend

The web surface for SlideOps: one React application that carries the marketing site, the Operator dashboard, and the Admin control plane behind role-based routing, with the shared packages that keep every area consistent.

![React](https://img.shields.io/badge/React-18-informational)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)
![Vite](https://img.shields.io/badge/Vite-5-purple)
![PWA](https://img.shields.io/badge/PWA-installable-success)
![pnpm](https://img.shields.io/badge/pnpm-10-orange)
![status](https://img.shields.io/badge/status-Phase%200-lightgrey)
![platform](https://img.shields.io/badge/platform-Linux-informational)

## What this is

SlideOps is an Infrastructure Operations Platform. It helps Operators discover, configure, deploy, secure, verify, and monitor their own Linux infrastructure over SSH. It orchestrates and explains the tools an Operator already runs, and it never owns the infrastructure. The Operator does.

This repository is the frontend monorepo. It is a pnpm workspace driven by Turborepo, holding one deployable application and the shared packages it builds on. The application serves three areas from a single origin and a single session: the public marketing site, the Operator area under `/app` for any signed-in account, and the Admin control plane under `/admin` for accounts with the admin role. Their look, their components, and their guidance all come from the same packages, so no area can drift. Change a token once and every surface updates.

The backend lives in a separate repository and is reached only through a versioned HTTP contract, so the two sides stay decoupled.

## Quick start

You need Node 22 and pnpm 10.

```bash
pnpm install
make dev
```

`make dev` runs the app through Turborepo on a single port:

| App | Port | What it is                                                                                             |
| --- | ---- | ------------------------------------------------------------------------------------------------------ |
| web | 4321 | The whole frontend: marketing at `/`, the Operator area at `/app`, the Admin control plane at `/admin` |

Run it directly instead:

```bash
make dev-web
```

Other common targets, listed in full by `make help`:

```bash
make build       # build the app and packages
make typecheck   # typecheck the whole workspace
make lint        # lint the whole workspace
make test        # run unit and component tests
make fmt         # format every file
make api-client  # regenerate the typed client from the backend contract
```

## Monorepo structure

```text
frontend/
├── apps/
│   └── web/                one React app: marketing, the Operator area, and the Admin control plane
├── packages/
│   ├── design-system/      tokens, theme, Tailwind preset, primitives
│   ├── ui/                 composed components built on the design system
│   ├── tooltips/           the guidance and tooltip engine
│   ├── api-client/         the typed client for the backend
│   ├── icons/              Lucide wrapper and the SlideOps marks
│   ├── config/             shared eslint, prettier, tsconfig, Tailwind preset
│   └── utils-runtime/      small, purpose-named runtime helpers
├── turbo.json
├── pnpm-workspace.yaml
├── docker-compose.yml
├── Makefile
└── package.json
```

## The application

One app, three areas, one session cookie. A single auth store reads `GET /auth/me` on boot and exposes the Operator and its role. A `RequireAuth` guard gates the operator area; a `RequireAdmin` guard gates the admin area and sends a plain Operator back to the app with a clear notice. The shell adapts by area: a marketing header and footer on the public routes, side navigation on wide screens and bottom navigation on phones for the operator area, and the denser admin navigation for the control plane.

- **Marketing** at `/` sets the visual tone: the Everlasting Beauty palette, generous space, and motion that feels considered rather than busy. The story, capability showcase, audience, docs from markdown, and pricing are each reachable as their own route.
- **The Operator area** at `/app` is where the work happens. It shows the Workspace, Nodes, the Capability catalog searchable by outcome, automations, reports, history, security including MFA, extensions, the command palette, and the Operation flow from plan review and approval through live execution to a verified result. It is responsive from small phones to large desktops, with bottom navigation on phones and side navigation on wider screens.
- **The Admin control plane** at `/admin` is deliberately calmer and denser, tuned for oversight rather than onboarding. It carries platform health, cross-tenant Operations oversight, analytics, the audit log, and audited emergency controls, plus operator suspension and role grants. It is reachable only from an account with the admin role.

## The packages

- **design-system** is the single source of visual truth. It holds the design tokens, the theme provider for light and dark, the Tailwind preset, and the accessible primitives (Button, Field, Card, Text). Apps reference semantic tokens and never hard-code a color.
- **ui** composes the primitives into shared building blocks: the AppShell with navigation, the PageHeader, and empty states.
- **tooltips** is the guidance engine. It provides an accessible Tooltip and Popover plus a keyed content registry, so every Capability, field, risk, plan step, verification result, and admin control carries plain-language explanation. It is a required part of the product, not an optional enhancement.
- **api-client** is the only thing that talks to the backend. It wraps fetch with auth and error normalization and provides a websocket stream helper. Its types will be generated from the backend contract.
- **icons** re-exports Lucide icons and renders the SlideOps fox mark and lockup inline as SVG.
- **config** holds the shared tsconfig base, the eslint flat config, the prettier config, and the Tailwind preset that encodes the palette and the semantic tokens.
- **utils-runtime** is a small, purpose-named set of runtime helpers, kept intentionally tiny.

## Design system and theming

Color comes from one place: the Everlasting Beauty palette, expressed as design tokens in the design-system package. The four brand colors are Rose Quartz, Peach, Cognac, and Marsala, with a warm neutral ramp derived to sit beside them and functional colors for success, warning, danger, and info. Semantic tokens map these to a light and a dark theme through CSS variables, and dark is a first-class theme designed alongside light, not a dimmed afterthought. Apps never hard-code a hex value; they use the tokens through the Tailwind preset, so a single change updates every surface.

## Conventions

- TypeScript everywhere, strict.
- Colors and spacing come from design tokens only, never hard-coded.
- Every interactive control has accessible guidance through the tooltip engine.
- Components are accessible by default: labels, roles, keyboard support, visible focus, and respect for reduced motion.
- The product language is the ubiquitous language. Operator, never user. Node, never machine or host. Capability, never feature. Operation, never task. Verification, never success check. Workspace, never dashboard in prose.
- Shared look and behavior come from the shared packages, so apps stay independent but never drift.
