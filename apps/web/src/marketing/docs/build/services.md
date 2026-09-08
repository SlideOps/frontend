# Services

A Service is one deployed workload running on one server inside one Project, under limits you set. This page covers what a Service is made of, the runtimes that actually exist, and everything you can do with one after it is running.

## What a Service is

Four things define a Service, and they are chosen independently:

| | |
| --- | --- |
| **Where it runs** | The Project it belongs to, and the Node it runs on |
| **Where it comes from** | Its source: a container image, a Git repository, or nothing, if it was already running |
| **How it runs** | Its runtime: a container, a Compose stack, or a systemd unit |
| **What it runs with** | Its command, its environment, its published ports, and its resource limits |

[Deploying](/docs/build/deploying) covers the source and runtime combinations in full. This page is about the Service itself.

## Two kinds of Service

The app distinguishes these, and the difference is visible everywhere.

### A software Service

Your application. An API, a frontend, a worker, a job runner. It has a source SlideOps can build or pull from, a single workload on the machine, its own shell, its own logs, and a CI/CD tab.

### A Capability Service

Infrastructure your Project depends on, deployed together under one name: PostgreSQL and Redis, say, as one Service called `data`.

It is deployed from **Deploy a Service → Capabilities** rather than the software form. Each Capability inside it runs as its own real Operation, planned, approved, executed, verified, and recorded in History, exactly as starting it on its own would. They do not depend on each other, so one failing does not stop the rest: the Service ends up running with whichever succeeded, and the failure reason names whichever did not.

A Capability Service has no address, no live usage of its own, no CI/CD tab, and no shell, because there is no single container to enter. Each engine inside it is reachable through the **Browse** tab and has its own History entry. You grow it with **Add a Capability** rather than by redeploying it.

## The runtimes

Three, and only three.

### Container

One container, run by Docker on the machine, with hard limits on CPU, memory, and processes.

This is the recommended choice and the one with the most management available: a shell inside the container, live logs, live resource usage, in-place resizing, and a preview.

Containers run with `--restart unless-stopped`, so the workload comes back when the machine reboots but stays down if you stopped it deliberately.

Docker must be on the server. If it is not, the deploy is refused with a message telling you to apply the Enable Containers Capability first.

### Compose stack

Several containers described by a `docker-compose` file in your repository: an application, its database, its cache, whatever the file declares. SlideOps reads the file and brings the stack up.

Choose this when the application expects other containers alongside it by name. Compose creates the network, so a hostname like `postgres` or `redis` in your configuration actually resolves. A single container on the default bridge cannot do that.

Because a stack is described by a file, **a Compose Service must come from a repository**. An image alone cannot describe a stack, and the deploy is refused if you try.

Docker Compose must be on the server, and there must be a compose file in the repository. Both are refused with a message naming what is missing.

A shell on a Compose Service is a shell **on the server**, in the stack's checkout directory, not inside any one container. The stack is several containers, so there is no single "inside" to enter.

Removing a Compose Service brings the stack down and removes orphans, but **leaves its volumes**. They hold data SlideOps did not create, and destroying it as a side effect of removing a Service would be wrong.

### systemd

No container at all. A command, run and supervised by the machine itself, with resource limits enforced through cgroups.

For workloads that should not be containerised, and for servers where Docker is not wanted.

A systemd Service **requires a command**, because there is no image entrypoint to fall back on. The deploy is refused without one, and so is a later configuration save that would leave it empty. Units are written with `Restart=always`.

A shell on a systemd Service is a shell on the server, in the Service's own directory. A systemd Service is not a container, so this shell is not confined to it. Opening it is recorded in the audit trail, as every shell is.

## Naming a Service

The deploy form asks for lowercase letters, numbers, and hyphens, starting with a letter or a number, under 64 characters. Names are not required to be unique, though giving two Services the same name in the same Project will make your own life harder.

The name is what you see everywhere, and it is what the confirmation asks you to type when you permanently delete the Service.

## Resource limits

Every Service runs under three ceilings: vCPU, memory in MB, and a maximum number of processes.

The recommended configuration is **0.5 vCPU and 256 MB**, with a safe process default applied for you. That suits most applications, and most Operators never change it. The Advanced control is there when you know you need more.

These are **your resources on your own server**, not a plan gate. Your tier bounds how many servers and Projects you can register; it does not bound CPU, memory, disk, or how many Services you run on a machine you own.

### Resizing

Resource limits can be changed **in place, with no rebuild and no downtime**, from the Service's Overview tab. SlideOps applies the new ceilings to the running workload directly: `docker update` for a container, `systemctl set-property` for a unit.

This is one of the few things that takes effect immediately. Everything else in the deployment configuration needs a redeploy.

## Status

A Service is in exactly one of five states:

| Status | Meaning |
| --- | --- |
| `deploying` | A deploy is in flight. The page polls until it settles |
| `running` | The workload is up |
| `stopped` | The workload is down, deliberately |
| `failed` | The last deploy or the workload itself failed. The reason is kept on the page |
| `removed` | The Service was removed. The record remains; it can never be redeployed |

A `failed` Service keeps the reason for its last failure on its own page, so an Operator who was not watching the live stream can still find out what happened.

## Lifecycle actions

From the Service's Overview tab:

| Action | What it does |
| --- | --- |
| **Start** | Starts a stopped workload |
| **Stop** | Stops a running workload without removing it |
| **Restart** | Bounces the existing workload. It does not pull, rebuild, or apply configuration |
| **Redeploy** | Re-runs the whole deploy: pull, rebuild, rerun. This is what applies a saved configuration change |
| **Cancel this deploy** | Only while deploying. Stops the work in flight |
| **Remove** | Stops and tears down the workload, freeing its allocation. The record stays |
| **Delete forever** | Permanently deletes the record, its activity, and its sealed secrets |

None of these goes through the Operation approval gate. Deploying is your explicit intent, and a start or a stop is a control rather than a proposal. They still stream their progress, they still record activity, and a deploy still verifies the workload is genuinely up before calling itself done.

Restart and Redeploy are easy to confuse and are not the same thing. See [Redeploying and rollback](/docs/build/redeploying-and-rollback).

### Remove versus Delete forever

**Remove** stops and tears down the workload and frees its allocation. The Service record stays, so you can still see it and its history. It can never be redeployed.

For an **adopted** Service, Remove means something different: it releases the workload from management. SlideOps did not create it, so it is left running exactly as it was, and it simply disappears from SlideOps.

For a **Capability Service**, Remove uninstalls every Capability that finished installing, unless another Service on the same server still depends on one. There is a separate checkbox to also destroy each Capability's data, which is permanent and off by default.

**Delete forever** is the irreversible one: the record, the activity trail, and any sealed secret the Service holds, wiped for good. Because it cannot be undone, it asks you to type `delete <the Service's name>` exactly. A checkbox would not be enough.

## Working with a running Service

### Overview

Its address and any published ports, a preview where the Service serves a page, live CPU and memory usage, its summary, the resize control, the update check, and the lifecycle actions.

### Logs

Live output, streamed over the same SSH connection SlideOps already holds. The stream reconnects through network blips rather than closing.

Above the logs sits **Diagnose**, and beside them sits the Service's own **activity trail**.

### Diagnose

Diagnose answers "the deploy was fine, so why is this broken now?".

It checks a deployed Service against the things that break after a good deploy: whether the server is reachable, whether the container is actually up or crash-looping (with its own last output, which is the line you would have gone to the terminal to read), whether every dependency it needs is still reachable from its server, and whether the hostname in front of it has anything listening.

It never changes the server. Where a failing check has a fix, it is offered right there, and applying it is a normal Operation with a plan you approve.

The same checks run in the background every ten minutes and record **a change, not a state**: an entry appears when a working Service starts failing, and another when it starts working again. A Service that has been fine all week is not announced hourly.

### Activity trail

Every Service keeps its own record: what deployed and from which commit, what started and stopped it, what changed its configuration, when a shell was opened in it, when it stopped working and when it recovered, and every deploy that failed along with the reason.

It sits beside that Service's output because the two answer one question together. The output tells you the application is unhappy. The record tells you that somebody changed three environment variables nine minutes before it became unhappy, which is the part you cannot get from the logs at any length.

A configuration change lists the variables that moved **by name**. Never their values, which is what lets this be shown on the Service page rather than hidden behind another permission.

This is not History. History records Operations, which act on a server through the full lifecycle. Most of what happens to an application is not an Operation at all.

### Shell

A real interactive session, over the SSH connection SlideOps already holds. No second credential, no agent.

For a container, the shell is **inside that container**, where only this application's files and processes are reachable. The rest of the server is not. SlideOps probes for `bash` and falls back to `sh`; if the image has neither, it says so plainly rather than failing obscurely, because a distroless image genuinely has no shell to enter.

For a Compose or systemd Service, the shell is on the server in the Service's own directory, and it is not confined.

Opening a shell is recorded in the activity trail.

A shell is only offered while the Service is running. There is nothing to enter otherwise, and the button says so.

### Browse

For a Service that has installed engines with a visual manager, Browse shows what they actually hold: databases and their sizes, queues and what is waiting in them, buckets down to each object, search indexes and their document counts.

Everything here is a read. It runs the moment you open the page, changes nothing, and does not fill History with records of you looking at things. A database is scoped to what this Service itself uses, so a database server shared by several applications never shows one application another's data. That narrowing is done by the server, from the Service's own configuration, so it holds however the request was made.

Anything that would change something, an edit or a restore, still goes through a plan you approve.

### Domains

The hostnames this Service answers on, and whether they are actually serving.

### Settings

The deployment configuration and the environment, the Service's connections to the Capabilities it uses, an environment diff against another Service in the same Project, and the credentials for anything it depends on. See [Environment and secrets](/docs/build/environment-and-secrets).

### CI/CD

Automatic deployment. See [Deploying](/docs/build/deploying).

## Addresses and ports

You give SlideOps the port your application listens on **inside** its container. SlideOps picks the public port.

That is the right default and it is not laziness: SlideOps knows every port it has handed out on that server and can see what the server already has listening, so two applications on one machine can never take each other's port. Public ports are allocated from a dedicated range, lowest first, so they are predictable.

If you want to choose the public port yourself, write the mapping as `host:container`, for example `8080:80`. A port you pin is honoured exactly, even if something else holds it. You may know something SlideOps does not, and the deploy reports the conflict from the server itself rather than quietly moving your application somewhere you did not ask for.

Every Service also gets a **hostname** when it deploys, without you configuring DNS, so it is reachable by name rather than at an address with a port number in it. The hostname survives a redeploy that moves the port, and it is the name a certificate is issued for. Where the server is reached by an IP address, that hostname is generated for you; where it is reached by a hostname of its own, nothing is generated.

The addresses shown on the Service page are computed on every read rather than stored, so they stay correct if the server's address changes. The first one is the base URL to give to another program: a frontend, a mobile app, or a second Service.

## Adopted Services

A workload that was already running on the server when SlideOps found it can be brought under management as it stands. See [Deploying](/docs/build/deploying) for the full story.

The short version: adopting changes nothing on the machine, and an adopted Service is fully managed for everything that reads the machine, but it can never be redeployed, because SlideOps did not build it and has nothing to rebuild it from.

## Where to go next

- [Deploying](/docs/build/deploying) for sources, runtimes, adoption, and CI/CD.
- [Environment and secrets](/docs/build/environment-and-secrets) for variables and sealed values.
- [Redeploying and rollback](/docs/build/redeploying-and-rollback) for what applies a change and what does not.
