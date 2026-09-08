# Servers

How SlideOps connects to a Linux machine you already own, what it learns by
looking at it, and why looking can never change it.

A **Node** is one Linux machine SlideOps reaches over SSH. The screens call it a
Server, because that is what it is to you; the API and the vocabulary call it a
Node. They are the same thing. See [the glossary](/docs/reference/glossary) for
the rest of the naming.

SlideOps never owns the machine. It signs in with a credential you gave it, as an
account you chose, and everything it does afterwards is something you could have
done yourself in a terminal.

## Adding a Server

Connecting a Server records how to reach it and stores the credential. It does
not change anything on the machine.

You give it:

- **Name.** What you will call it in SlideOps, for example `web-1`.
- **Hostname (optional).** A label for your own reference. It is not used to
  connect.
- **Address.** The IP or domain SlideOps connects to over SSH.
- **SSH port.** Defaults to `22`.
- **SSH username.** The account SlideOps signs in as. This becomes the
  *connection account*, and it matters a lot later: see
  [Server accounts](/docs/infrastructure/server-users).
- **Project (optional)** and **Tags (optional).** For grouping and finding it.

Then the credential, in one of three ways:

- Paste a **private key**. Recommended, and the option that will not lock you out
  when you later harden SSH.
- Paste a **password**.
- Pick a **saved key** from your key library.

If you paste a private key you can tick "Save this key to your library", which
imports it first and then registers the Server against the saved key, so the
Server ends up on exactly the same path a pre-saved key would have taken.

The credential is sealed the moment it arrives and is never shown again in the
registration form. Only the connection account's stored credential can be
revealed later, from that account's own panel.

### The host key

The Server's SSH host key fingerprint is learned on the first successful connect
and verified on every connect after that. If the machine is rebuilt and presents
a different key, connections fail rather than trusting whatever answered. That
shows up as a shell or an Operation that cannot reach the Server, with the reason
carried through rather than tidied away.

### Status

A Server reads as `unknown`, `reachable`, or `unreachable`, reflecting the last
time SlideOps actually tried. An unreachable Server has its terminal disabled
with the reason stated, rather than offering a button that cannot work.

## Discovery only ever observes

Discovery connects over SSH and reads the machine. It installs no package,
starts no service, writes no file, and changes no configuration.

That is a property of the design rather than an intention: the set of commands
Discovery runs is fixed and each entry is a read. It is why Discovery is safe to
run on a production Server, at any time, including one you have never touched
with SlideOps before.

### What SlideOps learns

One Discovery gathers:

- Operating system, distribution and version, and kernel
- Package manager and service manager
- Installed packages and running services
- Listening ports
- CPU, memory and disks
- SSH posture, including the effective sshd configuration
- Container runtime, if any
- Firewall backend, and whether it is actually active
- Web servers present (NGINX, Caddy, and others)
- Git
- Database engines present, their versions, and whether they are running
- TLS certificates present, and the names on them
- Human login accounts
- Pending updates

### Facts and Assessment

Discovery returns two things.

**Facts** are the raw typed snapshot: exactly what was read, nothing
interpreted. The noisy and sensitive parts, the full SSH configuration,
listening ports, package and service lists, start collapsed and mask their
values behind a reveal, so opening a Server's page does not put its
configuration on a screen behind you.

**Assessment** interprets the Facts in plain language:

- a **summary** of the machine
- **findings**, split into "Worth your attention" and "Already in order", each
  with a severity
- **recommendations**, the Capabilities worth running here and why
- an **inventory** of what is already present

Nothing in the Assessment is a decision. It says what it sees and what it would
suggest, and the suggestion is a link to a Capability you would still have to
start, plan and approve.

### Discovery on page load, and Discovery on demand

Opening a Server reads back the **last saved Discovery** without reconnecting, so
capacity, inventory and what is already installed appear immediately. A Server
that has never been discovered has nothing saved, so its first Discovery runs on
its own, because you should not have to press a button to see information
SlideOps already had the means to show.

Every later Discovery is yours to ask for, with the **Discover** button.

### Adoption: a Server you set up yourself

Discovery is also what makes a Server you built long before you found SlideOps
read as already set up. Capabilities whose outcome is already present are marked
as such, and the wording is deliberately different from work SlideOps did:

- **Already in place.** Found on the Server. There is no run to look back at and
  no credential SlideOps created. You can still run the Capability if you want
  SlideOps to apply its own settings.
- **Done.** SlideOps carried it out. There is a link straight to that run in
  History, and any credential it created is shown.

The two are never blurred together. SlideOps does not claim work it did not do.
More on this in [Capabilities](/docs/infrastructure/capabilities).

## Readiness and security posture

Beside Discovery, a Server page shows two standing readings.

**Readiness** is one meter and two lists: what is missing, and what is already in
place. Missing items lead, because they are the only part that needs a decision.
Each carries a severity, from Critical down to Optional. An item that cannot run
yet because a prerequisite has not been completed is marked blocked and links to
the prerequisite instead of to itself, so a click can never land on a form that
would only be refused.

**Security posture** shows the account SlideOps signs in as, whether root sign in
over SSH is still permitted, and whether password sign in is still on. Anything
the last read did not establish shows as **Unknown**. It is never guessed.

## Repairs are separate from Discovery, and some of them run

This is the part worth reading carefully, because it is the one place a
rediscovery changes something.

Discovery itself still only looks. That rule does not bend. What follows a
rediscovery is a separate step: SlideOps re-runs the ordinary path you would
have pressed yourself, as real Capabilities that are planned, executed, verified
and recorded in History on the Server they changed. The Server page says so out
loud, naming each thing it is putting right, while it happens.

Two things on the Server being rediscovered are repaired:

- A Service that was given a hostname with **nothing listening on 80 and 443** to
  answer it.
- A Service **published on a port with no web address** at all.

Both are repaired by re-running the same Expose step the deploy uses, which keeps
a hostname the Service already has. It is a retry, never a rename.

Several kinds of Service are deliberately excluded, because repairing them would
be wrong rather than merely unnecessary:

- a Service still deploying, which has not finished being set up
- a stopped Service, which is not meant to be working
- an **adopted** workload, which somebody else arranged and is not SlideOps' to
  change
- a Capability Service, which is the infrastructure other Services depend on

### The one repair that reaches another Server

If a Service here is configured to reach a database on **another** Server and
cannot, SlideOps opens the way on that other Server. It is the only repair that
touches a machine you were not looking at, and the reasoning is narrow:

- It only ever uses `configure-database-access`, which opens exactly one port to
  exactly one address and refuses outright to open a database to every address.
- The intent is not inferred. It is written in that Service's own environment:
  the Service is already configured to use that database.
- It only fires on a probe that conclusively failed, so once the path works the
  next rediscovery finds nothing to do.
- It runs as an ordinary Operation, in History, on the Server it changed.

Anything else is **reported and left alone**. "Something is listening on 8080 and
this Server cannot reach it" has no single safe fix, so it stays a decision for
you. See
[Firewall and database access](/docs/connect/firewall-and-database-access).

A failure to repair is never a failure to discover. The answer you asked for is
still there.

## The tabs on a Server

- **Overview.** Connection summary, capacity, security posture, readiness,
  health, domain routing, and Discovery.
- **Services.** What is running here. See [Services](/docs/build/services).
- **Capabilities.** The catalogue, with what has already been done here, what is
  recommended next, and what is blocked behind a prerequisite.
- **Terminal.** A shell on the whole Server. See
  [Terminals](/docs/infrastructure/terminal).
- **Settings.** Credential rotation, server accounts, tags.

## Changing how SlideOps signs in

Rotating the credential replaces the SSH username or the credential SlideOps
connects with. The new one is tested with a live connection **before** anything
is stored. If it does not sign in, the old credential is kept and the request
fails, so a typo cannot lock SlideOps out of your Server.

Every rotation is written to the audit trail: who, when, and from where, never
what.

Switching to another account that SlideOps itself created is a shorter path to
the same outcome, covered in
[Server accounts](/docs/infrastructure/server-users).

## What a Server page does not do on its own

- It does not change anything because you opened it.
- It does not run a Capability without a plan you approved.
- It does not touch sites or services on the Server that SlideOps did not set
  up.

The exception is the repair described above, which is announced on the page while
it happens and lands in History like any other Operation.
