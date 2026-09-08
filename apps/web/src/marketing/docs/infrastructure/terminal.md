# Terminals

There are two kinds of terminal in SlideOps, and knowing which one you are in is
the most important thing on this page.

A shell can do anything to a machine and leaves no other trace. Whatever you type
in one happens outside every Capability, plan and verification the platform has.
So the one question that must never be ambiguous is: **is this shell the whole
Server, or is it inside my application?**

## The two kinds

### A Node terminal is the whole Server

A terminal opened from a Server is the Server. It signs in as the account
SlideOps connects with, and it can do exactly what you could do by opening a
terminal yourself, and no more.

SlideOps is not granting access here. It is saving you a trip to another window,
using the account you gave it.

It is **unscoped, deliberately**. Pretending to confine a Server shell would be
theatre: the credential already reaches the whole machine, and a boundary drawn
in the interface that the connection does not enforce would be worse than no
boundary, because it would be believed.

It opens as the account's own login shell, so you get your prompt, your profile
and your aliases. The only thing added is where it starts: `/opt/slideops`, which
is where every Service's checkout lives. A login shell would otherwise start in a
home directory that is usually empty on a Server SlideOps deploys to.

### A Service terminal is scoped to that Service, and how far depends on the runtime

This is the part to read carefully, because the scoping is decided from the
Service's runtime rather than asked for. A shell that silently landed on the host
while you believed you were inside your application is the one outcome that would
actually be dangerous: you would run something destructive believing it was
contained.

**A container Service is entered inside its own container.** The filesystem, the
processes and the environment belong to that application, and nothing else on the
Server is reachable through it. That is not a restriction bolted on afterwards,
it is what a container already is: the shell is started inside the workload
rather than beside it.

SlideOps probes for `/bin/bash` first and falls back to `/bin/sh`, because a
minimal image frequently has no bash at all. It probes rather than trying and
failing, so you never have to read past an error to reach a prompt that worked.
An image with no shell at all says so:

```text
This image contains no shell, so there is nothing to enter. That is normal for a distroless or scratch image.
```

**A compose Service is a stack, so there is no single container to enter.** Its
shell lands on the Server, in the stack's own directory, with
`COMPOSE_PROJECT_NAME` already set so the usual commands address this Service's
stack without being told:

```bash
docker compose ps          # the containers in this stack
docker compose exec web sh # enter the one you want
```

Entering an arbitrary member of a stack silently would land you inside a
container while the page you came from was about the whole thing, so SlideOps
stands you beside all of them instead.

**A systemd Service is not a container, so there is nothing to enter.** Its shell
runs on the Server, in the Service's own directory, where its code and its files
are. It is **not confined to the Service**, and the terminal says so rather than
implying a boundary that is not there.

### The difference, in one table

| | Node terminal | Container Service | Compose Service | systemd Service |
| --- | --- | --- | --- | --- |
| Where it lands | The Server | Inside the container | The Server, in the stack's directory | The Server, in the Service's directory |
| Confined to the Service | No | **Yes** | **No** | **No** |
| Runs as | The connection account | Inside the container | The connection account | The connection account |

## The banner tells you which one you are in

Before the first prompt, every terminal writes a line saying what it is attached
to:

```text
You are on web-1, the whole server.
```

```text
You are inside the container billing-api.
```

```text
You are on the server, in this Service's directory. A systemd Service is not a container, so this shell is not confined to it. Nothing here is confined to this Service.
```

That last sentence is added to any shell that is **not** confined to its Service.
The banner is written by the server that opened the shell, so it is the
authoritative answer. If a panel's label and the banner ever disagree, believe
the banner.

## Elevation

Only one case needs root on the host, and it is not the one people expect.

**Entering a container needs it**, because talking to the Docker socket does and
the connected account is usually not in the docker group. That elevation is spent
getting through the socket; the shell lands inside the container regardless, so
it grants nothing on the host.

**A shell that lands on the host does not need it and does not have it.** It runs
as the connection account, which can `sudo` only if that account can, exactly as
it could in a Node terminal. Elevating those would turn "open a terminal on this
Service" into a root login shell on your Server, which is a larger thing than the
button says and larger than the Node terminal beside it.

The banner does not mention elevation, because it no longer changes what you can
reach. The audit entry records it.

## Opening one is recorded, and there is no approval

A terminal is not an Operation. An Operation is planned, approved, executed and
verified, and none of that means anything for a shell: planning one would be
predicting what somebody is about to type.

What replaces the approval gate is the **audit trail**. Every terminal that is
opened is recorded with who opened it, what it attached to, whether it was
confined, whether it was elevated, and when. That is the honest equivalent, and
it is the reason a shell can exist in a product whose whole promise is that
nothing touches a Server unseen.

Nothing connects on page load. The terminal is only opened when you ask for it,
because a shell that connected because somebody looked at a page would put a
session on your Server and an entry in your audit trail for a glance.

## A Viewer cannot open one

A terminal is the most write capable thing in the product. Everything typed in
one happens outside every Capability, plan and verification, and nothing else in
the API can do as much.

So a Viewer is refused, and the refusal arrives **inside the terminal**:

```text
Your role in this workspace is read only, and a terminal is not.
```

The decision is taken before any connection to your Server is made, so a refused
terminal dials nothing and records no shell as opened.

## Refusals arrive in the terminal, not as an error

Every reason a terminal cannot open is written into the terminal you are already
looking at, in red, and carried in the close reason:

- the Service is stopped, so there is nothing running to open a shell in
- the Server could not be reached
- the Server's host key has changed since it was registered
- your role is read only

This is deliberate. A WebSocket handshake that does not complete gives a browser
an error carrying no status, no body and no reason, so a stopped Service, an
expired session, a changed host key and a genuine outage would all arrive as one
sentence guessing that the server was unreachable.

## Working in a terminal

It is a real terminal, not a command box. Keystrokes go as you type them and
output comes back as it is produced, so you get a prompt, line editing, history,
Ctrl-C, and full screen programs like `top` and `vim`. Resizing the window
resizes the remote terminal, so those redraw correctly.

- **Tabs.** Several independent shells on the same target. Each tab is its own
  SSH session; switching away keeps its socket and its scrollback, and only
  closing a tab tears its session down.
- **A page of its own.** Any terminal can be opened in a new tab at its own
  route, with no application navigation on it, for the case an expanded panel
  cannot serve: a terminal on one monitor while you read something on the other.
- **The Workspace Terminal page.** Pick any Server or Service and open a shell on
  it, without going to that resource's page first. It dials the same connections;
  it is a different front door, not a different protocol.
- **Snippets.** A saved command can be picked into the active tab. It **types**
  the command and stops there. It does not press Enter for you: a snippet is a
  shortcut for typing, not a way to run a command nobody watched arrive.

When a shell ends, because you typed `exit` or the container stopped, the
terminal says so rather than freezing:

```text
The shell has ended.
```

The box stays on the page holding what it said as it went, and can be dismissed
without starting another session on your Server.

## When you should not reach for one

A terminal is outside the system. Nothing you do in one is planned, verified,
rolled back or explained to anybody else on the team.

Before opening one, it is worth checking whether the thing you were about to do
by hand is already a Capability, an Action on a Capability's management page, or
a fix that **Diagnose** on a Service would offer you with a button. Those leave a
record; a shell leaves only the fact that it was opened.

## Related

- [Servers](/docs/infrastructure/servers)
- [Server accounts](/docs/infrastructure/server-users)
- [Services](/docs/build/services)
