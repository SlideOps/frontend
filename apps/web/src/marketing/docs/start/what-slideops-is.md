# What SlideOps is

SlideOps is an infrastructure operations platform for people who run their own Linux servers. It connects over SSH, reads what is actually there, proposes a plan, waits for your approval, executes it in the open, and proves the result. This page explains what that means in practice, and, just as importantly, what SlideOps is not.

## The short version

SlideOps helps an Operator discover, configure, deploy, secure, verify, and monitor infrastructure they already own. It works over a plain SSH connection to machines you provisioned yourself, wherever they are: a VPS, a rack, a home lab, a cloud instance.

It orchestrates and explains tools you already use. Docker, systemd, apt, dnf, NGINX, Git, PostgreSQL. It does not replace any of them, and it does not hide them. When SlideOps installs Docker on a server, the result is Docker, installed the way that distribution installs Docker, and you can go and use it directly the moment SlideOps has finished.

## What it is not

Being clear about the boundaries is the fastest way to understand the product.

**It is not a cloud provider.** SlideOps does not sell, create, or rent servers. You bring machines you already have. If you have no server, SlideOps cannot give you one.

**It is not a container runtime.** It does not run your containers. Docker does. SlideOps installs Docker, configures it, deploys workloads through it, and reads its state back, but the runtime on the machine is the same runtime you would have installed by hand.

**It is not a replacement for Docker, systemd, apt, or NGINX.** Those tools stay exactly what they are. SlideOps decides which of them to use for what you asked for, drives them correctly for your distribution, and records what it did.

**It is not an agent you install.** There is nothing running on your servers on behalf of SlideOps. Every action is an SSH session, opened when there is work to do, closed when there is not. Removing SlideOps from your life means deleting an account; your servers carry on.

**It does not own your infrastructure.** You do, at every moment. SlideOps holds a credential you gave it, uses it with least privilege, and never operates as root once a server is secured. Everything it does is something you could have typed yourself.

## What it actually does

Three things, in order.

### It reads before it writes

Discovery opens a read-only connection and observes: the operating system and its family, the package manager, the init system, what is installed, what is listening, what the SSH configuration allows, what containers and sites are already running. It changes nothing. This is the picture every later decision is made from, and it is refreshed rather than remembered.

### It plans in the open, and waits

Nothing runs from a guess and nothing runs unapproved. Every change is expressed as a **Capability**, which describes the outcome you want without naming a technology, and carried out by a **Provider**, which knows how to reach that outcome on your particular platform. Before anything executes you see the whole proposal: every step in order, the risk each one carries, how the change would be undone, and how the result will be checked.

Approval is a real gate held by you. What you approved is exactly what runs.

### It proves the result

Execution is never the end. Verification always follows it, re-reading the machine to confirm the change took effect, and for anything that touches access, opening a fresh connection to confirm you were not locked out. Each check carries the evidence behind it. If verification does not pass, the change is rolled back and the Operation is recorded as failed with its output intact.

The whole sequence is one lifecycle that every Capability runs, without exception:

```
Discover → Assess → Recommend → Plan → Approve → Execute → Verify → Observe → Record
```

[How an Operation works](/docs/start/how-an-operation-works) walks through each stage in detail.

## Why the Capability and Provider split matters

This is the idea the rest of the product is built on, and it is worth understanding early.

A **Capability** is intent. "Enable containers." "Configure HTTPS." "Create an application user." It names an outcome and never a tool. It has no idea whether your server runs `apt` or `dnf`, `systemd` or OpenRC.

A **Provider** is the mechanism. On Ubuntu, enabling containers means one sequence of commands; on Fedora it means another; on Alpine another again. Each of those is a Provider. Provider selection is automatic, driven by what Discovery found on that particular machine.

The practical consequence: you express what you want once, and the same request works across a fleet of mixed distributions. The families covered today are Debian and Ubuntu, Fedora, RHEL, Rocky and AlmaLinux, Arch, Alpine, and openSUSE, across `apt`, `dnf`, `pacman`, `apk`, and `zypper`.

It also means the docs, the UI, and your own mental model can stay in terms of outcomes. You are not memorising which flag `useradd` takes on which distribution.

## What SlideOps holds, and what it does not

Since it reaches your machines, it is fair to ask what it keeps.

**It holds a credential per server.** A private key or a password, encrypted the moment it arrives, decrypted only at connection time, and never written to a log or returned by the API. There is no screen that shows it back to you, because there is no code path that could.

**It pins host keys.** A server's host key is trusted on first use and pinned after that, so a machine that starts answering with a different key is refused rather than silently trusted.

**It holds sealed secrets you explicitly seal.** An environment value you mark as secret is encrypted into a secret store, revealed only in memory to the deploy that needs it, and reads back everywhere else as `[stored securely]`. That is genuinely unreadable afterwards rather than merely hidden.

**It operates with least privilege.** Once a server is secured, SlideOps connects as a non-root account with sudo, never as root. Securing the server is the very thing that makes that true, and it verifies the new access works before committing to it.

**It does not hold your data.** Your databases stay on your machines. Reads are performed over the SSH connection when you ask for them and are not copied anywhere.

## Working with a machine that already has a life

Most servers worth managing were doing something before you found a tool for them. SlideOps is built for that case rather than for a blank machine.

**Assessment credits what is already there.** The security posture of a server is measured against what SlideOps actually observed on it, not against a record of what SlideOps has done to it. A firewall you configured by hand two years ago counts as a firewall.

**Existing workloads can be adopted as they stand.** Containers, Compose stacks, sites, and databases already running are found and listed, and can be brought under management without being restarted, rebuilt, or moved. Adopting changes nothing on the machine: SlideOps simply starts holding a record so the workload appears alongside everything else.

**Nothing is taken over.** You keep your shell, your tools, and your habits. A server under SlideOps management is a normal Linux machine that you can still `ssh` into and operate by hand, and SlideOps will notice what you did the next time it looks.

## Two levels

SlideOps separates the machine from the work running on it, and keeping the two apart is what lets one secured server carry several unrelated Projects.

**The server level** is about the machine itself: connect it, read it, secure it, manage its accounts, its firewall, its packages, its SSH. This is done once per server.

**The Project level** is about what runs on it: a Project holds a stack and the Services that use it, running on the servers assigned to it. Several Projects can share one large server, because every Service runs under hard resource limits.

[Core concepts](/docs/start/core-concepts) sets out the full model.

## Who it is for

SlideOps suits you if you run your own Linux and want the work to be understandable rather than memorised.

- **Developers** who want to ship an application to their own server without keeping a stack of shell commands in their head.
- **Platform engineers** who need the same outcomes reached consistently across a fleet of different distributions, with evidence that each one landed.
- **Self hosters** running the services they depend on, hardened and backed up, with a record of every change.
- **Home labs**, where a read-only quick check that never changes anything is exactly the right way to start.
- **Startups** standing up secure infrastructure early and needing to still understand it a year later.
- **Teams** who want one shared lifecycle, so every Operator plans, approves, and verifies the same way.

## When it is the wrong tool

Honest limits, because the wrong tool wastes your time.

**You have no servers and do not want any.** SlideOps assumes machines you own. A fully managed platform where you never see a server is a different product.

**You want Kubernetes as your primary abstraction.** SlideOps works with individual Linux machines, containers, Compose stacks, and systemd units. If your whole world is already a cluster and cluster-native tooling, SlideOps is not aimed at that.

**You want unattended automation with no human in the loop.** Approval before execution is not configurable away for interactive work. Scheduled Automations exist, and setting one up is your standing approval for those runs, but everything else asks.

**You need a general purpose configuration management language.** SlideOps expresses infrastructure as Capabilities from a catalog, not as arbitrary declarative code you author. If you want to write your own resource types from scratch, a configuration management system is a better fit. SlideOps does have a plugin SDK, but a plugin extends the catalog rather than replacing the model.

**You cannot reach the machine over SSH.** SSH is the only channel. No SSH, no SlideOps.

## Where to go next

- [Core concepts](/docs/start/core-concepts) for the model: Workspace, Project, Service, Server, Capability, Operation.
- [Quick start](/docs/start/quick-start) to go from a fresh account to a running application.
- [How an Operation works](/docs/start/how-an-operation-works) for the lifecycle in depth.
