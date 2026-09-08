# Core concepts

SlideOps uses a small, fixed vocabulary. One concept, one name, everywhere: in the app, in the API, and in these docs. Learn these eight terms and the rest of the product follows. This is the page to read first.

## The chain

Everything hangs off one relationship chain:

```
Operator
  └── Workspace
        ├── Node (a server)
        └── Project
              └── Service
                    └── Deployment (one release of that Service, running on a Node)
```

And running alongside it, the thing that makes changes:

```
Capability (what you want)
  └── Operation (one run of it, on one Node)
        └── Provider (how it is actually done on that platform)
              └── Verification (proof it worked)
```

The rest of this page takes those one at a time.

## Operator

You. An Operator is the account that owns and acts on infrastructure.

The word "user" is deliberately not used for this. In an infrastructure context "user" is ambiguous: it could mean the person at the keyboard, or a Linux account on a server. An **Operator** is the person; a **server account** is the Linux one. Keeping them apart matters when you are creating a non-root administrator on a machine.

An Operator account has an email, a password, and optionally two step verification. It carries an account role of Operator or admin, where admin only means access to the platform control plane.

## Workspace

A Workspace is the boundary that everything else lives inside. Servers, Projects, Services, Operations, and History all belong to exactly one Workspace, and nothing crosses between them.

Every account has a Personal Workspace. You can create more, and you can be invited into other people's. The switcher at the top of the app decides which one you are acting in, and every screen you see is scoped to it.

Inside a Workspace, each member holds a role:

| Role | What it can do |
| --- | --- |
| Owner | Everything, including deleting the Workspace |
| Admin | Everything operational, including inviting members |
| Member | Read and write: connect servers, deploy Services, approve Operations |
| Viewer | Read only. Every write is refused, in the UI and in the API |

Note the word Workspace, not "dashboard". A dashboard is a screen. A Workspace is a tenancy: it holds things and it draws a boundary.

## Node, and why the UI says Server

A **Node** is one Linux machine reachable over SSH. That is the whole definition. It has an address, a port, an SSH username, and a credential, and nothing else about it is assumed.

The domain calls it a Node. Most of the app's own navigation calls it a **Server**, because that is what an Operator calls the machine in front of them. They mean the same thing, and you will see both. In the API it is always `node`.

Registering a Node is not a change to it. SlideOps stores how to reach it, encrypts the credential, and connects on demand. There is no agent, no daemon, and nothing installed on the machine to make it a Node.

A Node belongs to at most one Project at a time, or to none. See [Projects](/docs/build/projects) for what that assignment does and does not mean.

Things that belong to the Node rather than to anything running on it: its accounts, its firewall, its packages, its SSH configuration, its health.

## Project

A **Project** groups a stack and the Services that use it. It is an organisational unit and a scope, not a machine and not a stage.

A Project holds:

- a name and a description
- an optional domain, so requests can reach it by name
- the servers assigned to it
- the Plugins installed into it, which unlock the Capabilities its Services can use
- the Services running in it

Note the word Project, not "environment". SlideOps has no built in notion of dev, staging, and production. If you want those, they are three Projects, and that is a choice you make rather than one the product makes for you.

Deleting a Project removes SlideOps' record of it. It does not touch your servers, and workloads running on them keep running.

## Service

A **Service** is one deployed workload: one application, API, worker, frontend, or piece of infrastructure, running on one Node inside one Project, under resource limits you set.

A Service has:

- a **source**: where the workload comes from (a container image, a Git repository, or nothing, if it was already running when SlideOps found it)
- a **runtime**: how it runs on the machine (a container, a Compose stack, or a systemd unit)
- resource limits: vCPU, memory, and a process ceiling
- an environment: the variables it runs with, some of them sealed
- published ports, and an address it answers on

There are two kinds of Service, and the app distinguishes them:

- A **software Service** is your application. It has a source SlideOps can deploy from, a shell, logs, and CI/CD.
- A **Capability Service** is infrastructure your Project depends on, such as PostgreSQL and Redis, deployed together under one name. It has no single container to open a shell into, because it is several independently tracked Capabilities.

[Services](/docs/build/services) covers both in detail.

## Deployment

A **Deployment** is one release of a Service: one act of taking a source and putting it on the machine.

The first deploy creates the workload. A redeploy replaces it: for a repository source it pulls the branch, rebuilds, and reruns, so a redeploy always means "take the newest code". A Service records the commit it is currently running, so you can tell what is live.

Two things follow from this that are worth holding on to:

- **A Deployment moves forward.** SlideOps does not keep previous releases to switch back to. See [Redeploying and rollback](/docs/build/redeploying-and-rollback) for what rollback does and does not cover.
- **A saved configuration change is not a live change.** A container bakes its environment and its command in when it is created, so editing them records what you want and the redeploy is what applies it. See [Environment and secrets](/docs/build/environment-and-secrets).

## Capability

A **Capability** describes what you want, in terms of an outcome, and never in terms of a technology.

"Secure SSH." "Configure the firewall." "Enable containers." "Install PostgreSQL." "Create an application user."

A Capability carries: a key, a name, a category, a description, its intent, its risk level, the platforms it supports, how its result will be verified, the parameters it needs, and the Capabilities it depends on. What it never carries is a command, a package name, or a distribution.

That is the whole point. A Capability is the same on Ubuntu and on Alpine, because it says nothing about either.

Capabilities are not something you author. They come from the catalog, and Plugins add to it.

### Core Capabilities and Plugin Capabilities

Some Capabilities are available on every server with nothing to install. The Core bundle covers the machine itself: securing SSH, the host firewall, network and database access rules, the application user, the accounts on the server, packages and updates, and health monitoring. It cannot be uninstalled, because it is what a server always needs.

The rest come from **Plugins**. A Plugin is installed into a Project, and installing it unlocks its Capabilities for that Project's Services. Runtimes, containers, static sites, web servers, private networking, and the extra security add-ons work this way, so a Project only carries the stack it actually uses.

A handful of Plugins covering the common data engines are also always available, so you do not have to install a Plugin before you can install a database.

The practical rule: if a Capability is refused with a message about a Plugin not being installed in this Project, open the Project's Stack tab and install it there.

## Operation

An **Operation** is one execution of a Capability against one Node.

The distinction matters and it is easy to blur: a Capability is a reusable definition, an Operation is an instance. "Secure SSH" is a Capability. "Secure SSH on web-1, approved at 14:32 on Tuesday, verified, recorded" is an Operation.

An Operation carries its Node, its Project where it has one, its Capability key, its parameters, its plan, its verification result, its error if it has one, and the timestamps for when it was created, approved, started, and completed. It also carries an ordered stream of events: every log line, every step boundary, every status change.

Every Operation runs the same lifecycle, and it is not skippable:

```
Discover → Assess → Recommend → Plan → Approve → Execute → Verify → Observe → Record
```

The statuses you will actually see on screen are `created`, `discovering`, `assessing`, `planning`, `awaiting_approval`, `approved`, `executing`, `verifying`, and then one of `completed`, `failed`, or `cancelled`. [How an Operation works](/docs/start/how-an-operation-works) explains what happens at each one.

Note the word Operation, not "task" or "job". A job is something a queue runs. An Operation is something you approved.

## Provider

A **Provider** knows how to reach an outcome on a specific platform. It is the other half of the Capability split.

One Capability, many Providers. "Enable containers" on Debian or Ubuntu is a Provider that goes through `apt`; on Fedora it is one that goes through `dnf`; on Alpine, `apk`. Each Provider implements the same six things: whether it supports this Capability on this machine, how to plan it, how to execute it, how to verify it, and how to roll it back.

**You never choose a Provider.** Selection is automatic and driven entirely by what Discovery found on that machine: the first Provider that says it supports this Capability on these facts is the one that runs. The selection is made again from fresh facts at execution time, not carried over from planning.

A Provider is an execution engine and nothing more. It does not render UI, store history, or decide policy. That separation is what keeps a new distribution a matter of adding a Provider rather than editing the product.

Note the word Provider, not "driver" or "adapter".

## Verification

**Verification** is the proof that an Operation did what it said. It always follows execution. An execution without verification is incomplete, and there is no way to turn it off.

A Verification is a set of checks, each with a name, a pass or fail, and the evidence behind it. Evidence is the actual observed value, not a restatement of intent: "effective value is `no`", not "we set it".

Two checks are worth knowing about specifically:

- The Capability's own checks, which re-read the machine to confirm the change took effect.
- One check every Operation gets regardless of Capability: **a fresh connection still authenticates**. SlideOps opens a brand new SSH connection after the change and confirms it works. This is what makes hardening SSH safe: a change that would have locked you out is caught while there is still a working connection to undo it with.

If verification does not pass, the change is rolled back and the Operation is recorded as `failed`. There is no half-successful outcome.

Note the word Verification, not "success check". A success check sounds optional.

## History

**History** is the record of every Operation: its plan, its live output, its verification result and evidence, and its outcome. Opening a past Operation replays exactly what happened; opening a running one joins it live.

Deleting a History entry removes SlideOps' record of a run. It does not undo the run.

A Service also keeps its own **activity trail**, which is a different thing. Most of what happens to an application is not an Operation: a start, a stop, a configuration edit, a shell being opened, a deploy that failed. Those land on the Service's own page, next to its logs, because "somebody changed three environment variables nine minutes before this broke" is the part logs can never tell you.

## Putting it together

A worked example, using every term once.

You are an **Operator**. In your **Workspace** you connect a **Node** called `web-1`. You run the quick check, which is read-only **Discovery** and Assessment, and it tells you root can still sign in over SSH.

You start an **Operation** for the **Capability** "Secure SSH" on `web-1`. SlideOps picks the **Provider** for that Node's distribution, builds a plan, and stops. You read the plan and approve it. It executes, and then **Verification** confirms the effective SSH configuration and opens a fresh connection to prove you are not locked out. The whole thing lands in **History**.

You then create a **Project** called `storefront`, assign `web-1` to it, and install the Plugins it needs. You deploy a **Service** called `api` from a Git repository. That first **Deployment** clones, builds, runs, and verifies. Later you edit an environment variable, redeploy, and the second Deployment picks up both the edit and the newest commit on the branch.

## Where to go next

- [Quick start](/docs/start/quick-start) to do exactly that, step by step.
- [How an Operation works](/docs/start/how-an-operation-works) for the lifecycle in depth.
- [Glossary](/docs/reference/glossary) for every term in one alphabetical list.
