# The Workspace private network

One private path between the Servers in a Workspace, so a Service on one can
reach a database on another without opening anything to the internet.

## The problem it removes

Connectivity between two of your own Servers used to be your problem to solve
once per database, per port, per consumer. A Service on one Server reaching a
database on another meant reasoning about public addresses, private addresses,
container addresses, listeners, and firewall rules, and then repeating all of it
for the next engine.

The engines were never what differed. The network underneath them was simply
missing.

The Workspace private network is that network. Every Server in the Workspace that
joins it gets a stable private address, and traffic between them travels over
that path instead of the public internet.

## What it is, concretely

- Every Workspace can have **one** private network.
- Addresses are allocated from a private range. The default is `10.88.0.0/16`,
  which is inside RFC1918 and deliberately not one of the ranges Docker, most
  home routers, or the common cloud VPC defaults occupy, so it is unlikely to
  collide with something already on your Server.
- The **first address of the range is reserved**. It is conventionally the
  network itself, and handing it to a Server invites confusion with a gateway
  that does not exist here.
- Addresses are handed out **lowest free first**, so they are deterministic and
  read in the order your Servers joined. That is what makes them recognisable to
  a human reading a routing table.
- A Server's private address is its identity here, and it is **stable**. It
  survives the Server's public address changing, which is exactly what a public
  address cannot do and why one is never used as an identity.
- SlideOps configures the network with **WireGuard**, over the same SSH
  connection it uses for everything else.

The keys are worth stating plainly: each Server's **private key is generated on
that Server and never leaves it**. SlideOps records the public key, which is
public by definition, and the endpoint other members dial. There is nowhere in
the model for a private key to leak from.

The network page lives at **Networking** in the Workspace.

## Turning it on is not joining

These are two separate things, on purpose.

**Enabling** the network creates it if the Workspace has none, reserves the
address space, and records the intent. It joins nothing and touches no Server.

**Joining** is per Server. Each join is real work on a real machine that can fail
on its own and be retried on its own, so each one is its own durable Operation.

Reading the network is any role: whether your Servers can reach each other is
context for anyone deploying anything. Enabling, joining, repairing and turning
it off need **Owner or Admin**. Being allowed to deploy an application is not the
same as being allowed to change what the Workspace's Servers can reach.

## Joining a Server

Press **Join** on a Server that is not on the network yet. What happens:

1. The Server is enrolled and allocated the lowest free address. Enrolment is
   idempotent: a Server already enrolled keeps the address it has rather than
   being given a second one.
2. Its membership is recorded as **pending**, and any reason a previous attempt
   failed is cleared, so a retry is legible rather than showing you the message
   from the attempt before last.
3. A durable Operation runs on that Server: install WireGuard from the Server's
   own package source, generate its keypair if it has none, enable IP forwarding
   so traffic can reach services through the network, write the interface
   configuration, and bring the interface up.
4. **The Operation is watched to completion.** The membership becomes **joined**
   only once that Operation has actually finished and been verified.
5. Once it has joined, every other Server already on the network has its peer
   list rewritten so the new member is reachable from them too.

That last step is not politeness. A mesh is only as joined as its least informed
member: a Server that knows about everyone, on a network where nobody knows about
it, can reach nothing.

### An address is not a promise

Creating the Operation only says the work was scheduled. That is why the join is
watched: an address in the membership table never implies traffic can flow, and
"joined" means the Operation ended successfully, not that it was started.

The join returns **202 Accepted** rather than 200 for exactly this reason.

## Member states

There are five, and they are kept apart because they mean different things to
you. Collapsing them into "connected or broken" is what turns a page like this
into something people stop reading.

| State | Shown as | What it means |
| --- | --- | --- |
| `pending` | Joining | Enrolled, and the Operation that configures it is in flight. Work in progress, not a fault |
| `joined` | Connected | Configured and verified. This is the only state that carries traffic |
| `failed` | Failed | The join did not succeed. The reason is shown beside it, and there is a **Retry** |
| `disabled` | Excluded | Deliberately not on the network. A decision, not a fault |
| `removed` | Removed | The membership has ended and the address is free to reallocate |

A Server that is simply **not a member yet** is not any of these. It appears with
"Not on the network yet" and a **Join** button, and is never rendered as an
error.

Only a `joined` member is treated as reachable. That single definition of "up"
lives in one place, so no screen invents its own.

### Why a failure carries its reason

A member that failed records **why**, in plain language, on the membership
itself. The network page is where you look when a Server is not reachable, and
"failed" with no reason is exactly what this layer exists to stop producing.

If the failure was in reading the Operation's result rather than in the Operation
itself, it says that too, rather than reporting a join failure that may not have
happened.

## Peers

A Server's peer list contains every **other** member that has actually joined and
has reported a public key. Pending and failed members are deliberately left out:
configuring a peer that cannot answer produces a Server whose configuration
disagrees with reality.

Each peer is added with **its own address as a single host route**, not the whole
network range. If every peer claimed to route the whole range, WireGuard would
resolve the overlap by last match, and your routing would depend on file order
rather than on membership.

The Server's own address carries the network's prefix length, so it has a route
to the rest of the network rather than only to itself. An interface that comes up
and reaches nobody is the failure that looks like success.

## Repair

**Repair** rewrites every joined member's peers so each Server's configuration
matches current membership.

This is the drift fix. A Server that was rebooted, restored from a snapshot, or
edited by hand converges back, because the join Capability writes the
configuration **whole from desired state** rather than merging into what it
finds. A peer that is no longer a member disappears, which is the behaviour a
managed network needs and the opposite of what a hand managed tunnel wants.

If one Server cannot be reconciled it is logged and the others still are. One
unreachable Server must not stop every other Server learning about the new
member, which would turn one Server's problem into the whole Workspace's.

## Turning it off

Disabling the network keeps everything. Addresses stay allocated and members stay
recorded, so turning it back on restores the same layout rather than renumbering
every Server.

What it does do is stop the traffic. **Any Service reaching a database on another
Server over this network stops working the moment it is off.** The confirmation
says so, because an Operator who has wired a Service to a database on another
Server is about to break it.

## Using it

Once two Servers are connected, a Service on one reaches a database on the other
at the database Server's **private address**, on the database's own port. Nothing
is published to the internet, and the address does not change when the Server's
public address does.

You may still need a rule at the destination, because a network path and
permission are not the same thing. The database's own access control and the
Server's firewall both have to allow the source. That is one reviewed plan:
see [Firewall and database access](/docs/connect/firewall-and-database-access),
which also explains why this is the better answer than opening a port.

The private network is also what makes a single Workspace entry point possible:
one Server can answer for every hostname and forward to whichever Server runs
each Service, over this network rather than through public ports on every
application Server. See [Routing](/docs/connect/routing).

## Related

- [Servers](/docs/infrastructure/servers)
- [Core concepts](/docs/start/core-concepts)
- [Firewall and database access](/docs/connect/firewall-and-database-access)
