# Projects

A Project groups a stack and the Services that run it, on the servers assigned to it. This page explains what a Project actually organises, what assigning a server does and does not do, and why the model is split into a server level and a Project level.

## Why two levels

SlideOps keeps the machine and the work running on it apart, deliberately.

**The server level** is about a Node: its accounts, its firewall, its packages, its SSH configuration, its health. You connect a server once, read it, secure it, and then it is a secured server. That work is not repeated per application.

**The Project level** is about what runs on it: the stack a Project needs, and the Services that use that stack.

Keeping them apart is what lets one secured server carry several unrelated Projects, each carrying only the stack it uses. Every Service runs under resource limits, so they do not fight over the machine.

It also means a Project is cheap. Creating one is a filing decision, not an infrastructure change.

## What a Project holds

| Tab | What is there |
| --- | --- |
| Overview | Project health at a glance, the servers assigned to it, and the GitHub connection deploys pull from |
| Domains | The hostname requests reach this Project by, and how routing is going |
| Stack | The Plugins installed here, and what else could be added |
| Capabilities | Everything runnable in this Project: the Core Capabilities plus what the installed Plugins unlock |
| Services | The Services running in this Project, each on one of its servers |

A Project itself carries almost nothing: a name, a description, an optional domain, and the timestamps. Everything interesting is a relationship to something else.

## Creating a Project

Go to **Build → Projects** and create one. A name is required, and it is the only required field. There is no naming convention imposed: SlideOps only trims whitespace and refuses an empty name.

How many Projects you can have is bounded by your tier. That is one of the few things a tier does bound; it does not bound CPU, memory, disk, or the number of Services on a server, because those are your own resources on hardware SlideOps does not own.

## Projects and servers

### Assigning

Open the Project's Overview tab and assign one of your secured servers.

**Assigning changes nothing on the server.** Nothing is installed, nothing is restarted, nothing is reconfigured. It records which Project the server belongs to, so the right options appear in the right place: the Project's Capabilities become startable on it, and the Project's Services have a machine to run on.

A server belongs to **one Project at a time**, or to none. Unassigning returns it to the server level. Nothing on the machine changes and nothing running on it stops; the server stays registered in your Workspace, still connected and still secured, and can be assigned somewhere else.

### Why not just deploy straight to a server

You can, in the sense that the deploy form lets you pick any server you own. The assignment is not a hard gate on where a Service may run.

What assignment buys you is the Project's own view of itself: which machines this Project is spread across, whose health matters to it, and where its Capabilities can be started from the Project page. A Project with no servers assigned tells you to assign one before offering to run a Capability, because a Capability runs on a server and there is nothing to choose from.

### Several Projects, one server

This is the intended shape rather than a workaround. Two Projects can each be assigned their own servers, or you can move a large server between Projects as your layout changes. Because every Service runs with a CPU ceiling, a memory ceiling, and a process ceiling, the workloads of one Project cannot starve another's.

## Projects and the stack

The **Stack** tab is where a Project gets its capabilities beyond the built in ones.

Three states appear on a Plugin card:

- **Built in.** Always available on every server, nothing to install, cannot be removed. The Core security bundle is like this, and so are the common data engines.
- **Installed.** Installed into this Project. Its Capabilities are available here, and can be disabled or uninstalled.
- **Available.** In the Marketplace, not installed here.

Installing a Plugin into a Project is what unlocks its non built in Capabilities for that Project's Services. Running one without it is refused, with a message naming the Project and the Plugin, so the fix is always "install it on the Project's Stack tab".

Uninstalling removes the Plugin from this Project. Its Capabilities stop being available here, and Services that rely on it may no longer deploy. It stays in the Marketplace and can be installed again.

This is why the model is per Project rather than per account. Installing a Python runtime into a Go Project would be waste, so you never have to.

## Projects and Services

A Service belongs to exactly one Project and runs on exactly one server. The Project is what gives it context:

- Which Capabilities it may use, from the Project's stack.
- Which repositories the deploy form offers, from the Project's GitHub configuration.
- Which other Services it can be compared against when you diff environments.
- Which domain sits in front of it, when the Project has one.

The Project's **Services** tab lists them with their status and their server. The global **Services** list shows every Service in the Workspace across all Projects.

Deploying into a Project from its own page preselects the Project, which is the shortest path when you already know where it belongs.

## Project health

The Overview tab leads with a health summary: what is running, what is missing, and where to go next.

It is written as a short list of issues rather than a wall of green, because a Project with nothing wrong needs one line and a Project with something wrong needs the something. A Project with no servers assigned, or a Service that has stopped, shows up here first.

## Common shapes

SlideOps does not impose a layout, so here are the ones that work.

**One Project per application.** The simplest. The Project holds the application's Services, the stack they need, and the servers they run on. Most people start here.

**One Project per stage.** `storefront-staging` and `storefront-production`, each with its own servers and its own Services. Because SlideOps has no built in environments, this is how you get them, and the separation is real: different servers, different stacks, different secrets, no shared configuration to leak across.

**One Project per team.** Where several small applications belong to one group of people and share a stack, one Project with several Services is less to keep track of than several Projects with one each.

What does not work well is one Project for everything. The Project is what scopes which Capabilities are available and which repositories the deploy form offers, so a Project that holds everything offers everything, everywhere, and the narrowing that makes the Stack tab useful stops narrowing.

## Projects and domains

A Project can carry a domain: a plain lowercase hostname like `app.example.com`, with no scheme, no port, and no path. At least two labels are required, so a bare word is refused.

Setting one lets you point DNS at the Project's server and route by name. The **Domains** tab is where you set it, and it also shows which host ports the Project's Services occupy on each server, so it stays clear which Project a given request actually reaches.

Where the deployment is configured with a default domain base, a new Project is given a hostname derived from its name automatically, so it has one from the start.

An individual Service also gets its own address when it deploys, without any DNS work from you. A Project domain is the layer above that.

## Deleting a Project

Deleting removes SlideOps' record of the Project: its installed stack and its Service records and its server assignments.

**It does not touch your servers.** The servers assigned to it return to the server level and stay connected and secured. Workloads running on those machines keep running: SlideOps deleting a row does not stop a container.

If you want the workloads gone too, remove the Services first, on their own pages, where the confirmation tells you exactly what will be torn down.

## Where to go next

- [Services](/docs/build/services) for what runs inside a Project.
- [Deploying](/docs/build/deploying) for how a Service gets onto a server.
- [Core concepts](/docs/start/core-concepts) if the relationship between Workspace, Project, Node, and Service is still fuzzy.
