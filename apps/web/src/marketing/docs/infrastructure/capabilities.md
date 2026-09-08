# Capabilities

What a Capability is, how you install one, how much of the machinery underneath
you are expected to know, and how a Capability relates to the Services that
depend on it.

## A Capability is an outcome, not a tool

A **Capability** describes what you want to be true of a Server. "Enable
containers." "Serve this domain over HTTPS." "Install PostgreSQL." It is written
in your language, not the machine's, and it never names a package manager, a unit
file, or a command.

A **Provider** is what knows how to make that true on one particular kind of
machine. One Capability, many Providers. Which Provider runs is decided
automatically from what [Discovery](/docs/infrastructure/servers) found: the
Provider that supports this Capability on this Server's actual platform is the
one selected.

That split is the whole reason the catalogue reads the way it does. You search
for **the outcome you want**, not the technology behind it.

Each Capability in the catalogue carries:

- a **key** (`configure-https`), which is its stable identifier
- a **name** and a **category**
- a **description** and an **intent**, which is the one line answer to "why would
  I run this"
- a **risk level**: low, medium, or high
- the **platforms** it supports
- a **verification strategy**, which is how success will be proved afterwards
- **parameters**, if it needs anything from you
- **dependencies**, other Capabilities that must be done first
- **requirements**, external configuration or accounts you need to have
- **actions**, which are what you can do to it once it is installed

## Core and Marketplace

Two kinds of Capability, and where they run differs.

**Core Capabilities** are about the machine itself: its accounts, its firewall,
its packages, its SSH. They run on any Server, with no Project.

**Marketplace Capabilities** come from Plugins you install. They run inside a
**Project**, and they are what the Services in that Project use. A database is a
Marketplace Capability, which is why its management is scoped the way it is.

The catalogue at **Capabilities** lists everything, grouped by category and
searchable by outcome. A Server's own Capabilities tab shows the same list with
this Server's state attached, and a Project's page shows its Plugin Capabilities
with a Server picker.

## Installing one

Nothing about installing a Capability is a single button that does work.

1. **Choose the Server.** From the catalogue you pick one; arriving from a Server
   page it is already chosen.
2. **Fill in the parameters.** The form is generated from the Capability's own
   declared parameters, one control per parameter, typed and validated from the
   same list, with the help text attached. A Capability with no parameters is just
   a start button.
3. **Start the Operation.** This does not execute anything. It opens the
   Operation at its **plan**.
4. **Read the plan.** Every step, its description, its risk, and its effect on
   the Server. Plus the risks as a whole, how it would be rolled back, and how it
   will be verified.
5. **Approve.** Only now does anything run.
6. **Verify.** Verification always follows execution. An execution without
   verification is not finished.
7. **Record.** It lands in History, with its events, its plan, and its result.

That lifecycle is the same for a Capability you started, a fix SlideOps offered
you on a Service, and a repair a rediscovery began. There is one path, and it is
the one you can read.

### When a prerequisite is missing

A Capability that declares dependencies is marked **Blocked** where its
prerequisite has not been completed. The action on it points at the prerequisite
rather than at itself, so a click never lands on a form that would only be
refused. The Operation engine enforces the same rule, so the screen can never
promise a start the API would then reject.

### Running one again

Every Capability in the catalogue is written to be safe to run again. An install
re-pins a chosen version; a manage step resets a password and can turn on an
option it did not the first time. The screen says so rather than leaving you to
find out by trying.

The action is labelled **Re-run** when SlideOps did the work, and **Run anyway**
when the outcome was simply found in place.

## What you do and do not need to know

You **do** need to decide:

- which Server this outcome belongs on
- the parameters, which are stated in your terms (a database name, a domain, a
  version, an account)
- whether the risk and the plan are acceptable

You do **not** need to know:

- which package manager the Server uses, or which service manager
- what the package is called on this distribution
- which configuration file holds the setting, or its syntax
- what command would have done it

That is the Provider's job, and it is chosen for you from the Facts. The plan
still shows you what will happen in plain language, so nothing is hidden; you
simply do not have to supply it.

## Already in place, in two different senses

A Capability's state on a Server is one of three things, and the wording is
deliberately different for two of them.

**Done.** SlideOps carried this out here. The card says when, and which version
where one was recorded, and links straight to that run in History. Any credential
the run created is shown right here, revealed and copyable, rather than only in
History.

**Already in place.** The outcome was found on the Server when SlideOps looked.
There is no run of ours to look back at and no credential SlideOps created,
because SlideOps did not do it. You can still run the Capability if you want
SlideOps to apply its own settings.

**Not done.** The plain start action, with a note when the Assessment recommends
it here.

SlideOps never describes work it did not do as its own.

## A Capability's page becomes its management page

Before something is installed, its page describes what it would do. Once it is
installed on a Server, the same page is where you work with it: what it holds,
what is connected to it, and a copy of it.

Those management surfaces come from the Capability's declared **Actions**. The
distinction that makes them safe is built in rather than left to whoever wrote
the screen:

- **A question runs immediately and changes nothing.** Listing the databases on a
  server, reading a queue depth, showing an index's document count. It is not
  planned, not approved, and does not fill History with records of you looking at
  things.
- **A change is always an Operation.** Replacing a database destroys what is
  there, so it is planned, approved, executed, verified and recorded, however it
  was started.

An action that changes something cannot run through the path that answers
questions. The shape is the same in every category:

| Category | What its page becomes |
| --- | --- |
| Databases | The databases and their sizes, what is connected now, an export, and a restore |
| Containers | Every container on the Server, its logs, shell, environment and resource use |
| Web servers | The sites each web server has configured, and what they listen on |
| Messaging | Queues or streams, with how much is waiting |
| Storage | Buckets, browsable down to each object's size |
| Search | Indexes, with their document counts |
| Runtimes | The installed version, and every process of it running now |
| Networking | An interface's peers, with when each was last seen |
| Security | Fail2ban, automatic updates, key only SSH and a server audit as one checklist |
| Monitoring | The same live health panel as the Server dashboard |

None of it needs a shell, a client tool, or knowing the underlying command.

## Capabilities and the Services that depend on them

A **Service** is your application. A Capability is usually what your application
depends on: the database, the cache, the runtime, the proxy.

### The network profile

A Capability that is a network service declares, once, what it looks like on the
network: the scheme a client uses, the protocol, the default port, and how far it
should be reachable before anyone asks for more.

For every database and cache in the catalogue, that default exposure is
**Workspace private**: reachable by the Workspace's own Servers and nothing else.
That is what its consumers need, and it is not the public internet. A web server
is the one thing declared **Public**.

A Capability with no network profile, an installed language runtime or a
hardening measure, is not a network service at all, and that absence is
meaningful rather than missing information.

### Connect

Wiring a Service to a Capability writes that Capability's host, port and
credentials into the Service's own environment, under a prefix. The Service's
Settings tab then shows a **Connected to** list, which is the reverse of the
**Used by** list on the Capability's own credential card. Both are reading the
same connections from opposite ends.

Because a database server usually carries one database per application, a Service
sees only the database it actually uses. The narrowing is done by the server,
from the Service's own configuration, so it holds however the request was made.

### Reaching it from another Server

A Service on one Server reaching a database on another needs two things to be
true: the network path, and permission at both the firewall and the database's
own access control. The private network is the better answer to the first, and
`configure-database-access` is the one reviewed plan for the second. See
[the private network](/docs/infrastructure/private-network) and
[Firewall and database access](/docs/connect/firewall-and-database-access).

## Two Capabilities that are not Operations

`open-node-shell` and `open-service-shell` appear in the catalogue so a terminal
is discoverable and describable with its risk stated, like everything else that
reaches your Server.

They are not run as Operations. An Operation is a planned change that is verified
afterwards, and a terminal is neither: planning one would mean predicting what
somebody is about to type. What replaces the approval gate is the record that one
was opened. See [Terminals](/docs/infrastructure/terminal).
