# Firewall and database access

What actually controls whether one Server can reach a database on another, and
why the private network is a better answer than opening a port to the internet.

## Two things control reach, not one

A database installed on one Server and an application on another can both report
perfectly healthy while the connection between them simply does not work. That is
almost always because only one of two independent gates was opened.

1. **The operating system firewall** on the database's Server. It decides whether
   traffic reaches the port at all.
2. **The database's own access control.** PostgreSQL has `listen_addresses` and
   `pg_hba`. MySQL, MariaDB, MongoDB and Redis have a bind address. Each decides
   whether traffic that reached the port is allowed to reach the database.

Both have to allow it. Opening one and not the other produces exactly the state
described above, and it used to be two unlinked Operations you had to remember to
run together, in the right order.

## The Capabilities involved

### Enable the firewall

`configure-firewall` turns on a default deny firewall and keeps SSH reachable. It
takes no parameters, and it stops there. That is the whole intent: everything
after it is a deliberate exception.

### Allow one source to reach one port

`allow-network-access` makes one narrow hole. It is separate from enabling the
firewall because the intents are different, and folding them together would mean
every rule change re-ran the enable, and History could not tell "I enabled the
firewall" from "I opened a port".

The rule is narrow by construction:

- **A source is required.** There is no way to express "open this to everyone" by
  leaving a field blank.
- A **destination address** can pin the rule to one interface, which is what
  stops a rule meant for the container bridge from also exposing the port to the
  internet.
- The protocol defaults to `tcp`, which is what databases, caches and web
  services use.

Everything is validated before anything runs. A malformed source or an out of
range port becomes a plan that fails to build, with a message naming what was
wrong, rather than a command that runs and either errors obscurely or, worse,
succeeds having written a rule that means something other than what you asked.

#### It refuses to write a rule into a firewall that is off

If the firewall tool is installed but not currently active, the plan is refused
before anything runs.

This matters more than it sounds. A rule "added" to an inactive firewall is
accepted by the tool, reported as a successful change, and the port genuinely is
reachable afterwards. Not because the rule permits it, but because nothing on
that Server is filtering anything at all. That is the opposite of what granting
one narrow exception is supposed to mean.

### Grant access to a database, both halves at once

`configure-database-access` is the one you will normally use. It plans **both**
halves as one reviewed change: the firewall rule that lets traffic reach the
Server, and the database's own access control that lets it reach the database.

- **It never allows every address.** Unlike the general firewall Capability,
  which you might reasonably want unscoped for some other narrow reason, the
  entire purpose here is a known, specific consumer. "Everyone" is never a
  legitimate answer to "who is this database for", so the plan refuses outright
  rather than merely warning.
- **You describe the other Server**, the one connecting in, and this database's
  own port. Never this database Server's own address. That is the single most
  common confusion, and the screen says it in as many words.
- **It runs on the database's own Server**, which is where both halves are
  applied.
- **The source is a Server picked from your inventory, or a CIDR** written by
  hand for a machine SlideOps does not manage.

What it does on the database side depends on the engine, and the difference is
worth knowing:

| Engine | Database side | Consequence |
| --- | --- | --- |
| PostgreSQL | `listen_addresses`, plus a `pg_hba` entry scoped to that source | Genuinely per source. Granting a second consumer never disturbs the first |
| MySQL, MariaDB, MongoDB, Redis | One shared bind address, widened only if it is not already wide enough | Every consumer shares one setting. The firewall rule is what actually restricts who can reach the port |

For the second group, granting a second consumer when the engine is already bound
wide enough is a no-op on the database side, checked live at execution time. The
firewall rule is still doing the real work.

### Revoking access

`revoke-database-access` removes one source's **firewall** access to a database.

It never touches the database's own side. Another consumer may already depend on
it, and narrowing a shared bind address back down needs a check against every
other access rule that this Capability deliberately does not perform. Rules are
reference counted against every consumer for exactly this reason, so removing one
consumer never breaks another.

## Seeing what is currently allowed

A database Capability's page has a **Networking** section listing every rule
currently protecting it:

| Column | Meaning |
| --- | --- |
| Source | The address or range allowed in |
| Port | The port and protocol |
| Topology | Same Server or cross Server |
| State | `planned`, `applied`, `detected`, `removed` or `failed` |

It is read from SlideOps' own record rather than derived live over SSH, so it
still answers when the Server is briefly unreachable.

A rule outlives whichever Service first asked for it, and more than one Service
can depend on the same rule. That is why it is tracked as current state rather
than as an entry in a Service's history.

If the database is only ever reached from the same Server, no rules are needed at
all, and none is not a problem.

Each run of the Capability creates its own independent rule, one per other Server
that needs to connect, so you can add or remove one later without affecting any
other.

## Why the private network is the better answer

The obvious way to let a Service on one Server reach a database on another is to
open the database's port to that Server's public address. It works. It is also
the worse answer, for reasons worth being explicit about.

**A public port is protected only by credentials and a source rule.** The
database is on the internet. Anyone who finds it is one credential away, and the
source rule is a public address that can change.

**The address is not stable.** Public addresses move. When one does, the firewall
rule that named it is now allowing somebody else and refusing you, and nothing
announces that.

**It does not compose.** A firewall rule per database, per port, per consumer,
repeated for the next engine, is the work this platform exists to remove.

The [Workspace private network](/docs/infrastructure/private-network) is the
alternative. Every Server that joins gets a **stable private address** allocated
from a private range. Traffic between them travels over that path instead of the
public internet, and the address survives the Server's public address changing,
which is exactly what a public address cannot do.

This is also the platform's own opinion, declared rather than implied: every
database and cache in the catalogue declares its default exposure as **Workspace
private**. That is what its consumers need, and it is not the public internet.
Opening a database to the internet is a decision you make explicitly, not a
default you fall into.

A rule is generally still needed with the private network, because a network path
and permission are not the same thing. The difference is what the rule names: a
stable private address rather than a public one, and a port that is reachable
only from inside the network rather than from the world.

## When SlideOps opens one of these for you

Rediscovering a Server does one thing that reaches another Server: if a Service
here is configured to reach a database on another Server and conclusively cannot,
SlideOps opens the way on that other Server.

The reasoning for allowing that, and only that, is narrow:

- It only ever uses `configure-database-access`, which opens exactly one port to
  exactly one address and refuses to open a database to every address.
- The intent is **not inferred**. It is written in that Service's own
  environment: the Service is already configured to use that database.
- It only fires on a probe that conclusively failed, so it is self limiting. Once
  the path works, the next rediscovery finds nothing to do.
- It runs as an ordinary Operation, planned, executed, verified and recorded in
  History on the Server it changed, and the Server page names that Server while
  it happens.

Anything else is reported and left as your decision. "Something is listening on
8080 and this Server cannot reach it" has no single safe fix, and the general
firewall Capability would open an arbitrary port on an arbitrary Server for a
reason SlideOps only guessed at.

## When it is already broken

**Diagnose** on a Service is the second look, on demand and repeatable. It checks
the three things that break after a good deploy:

- the container is crash-looping, with its own last output shown
- a dependency it is configured to reach is no longer reachable
- the hostname in front of it answers nobody

It never changes the Server. Each failing check comes back with the fix as a
button, and for an access problem the fix runs on the **Server being reached**,
not the one doing the reaching.

That distinction is the same one the Networking section makes: you are always
describing the other Server.

## Related

- [The Workspace private network](/docs/infrastructure/private-network)
- [Capabilities](/docs/infrastructure/capabilities)
- [Servers](/docs/infrastructure/servers)
- [Services](/docs/build/services)
