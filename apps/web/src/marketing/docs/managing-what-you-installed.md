## Managing what you installed

Installing a database is the beginning. This is what SlideOps can do with it
afterwards.

### A Capability's page becomes its management page

Before something is installed, its page describes what it would do. Once it is
installed on a server, the same page is where you work with it: what it holds,
what is connected to it, and a copy of it.

Nothing appears until there is something to manage, so a Capability you are only
reading about looks exactly as it did before.

### Questions and changes are not the same thing

Asking which databases exist is a question. It runs immediately and changes
nothing, so it is not planned, not approved, and does not fill your History with
records of you looking at things.

Replacing a database destroys what is there. That is a change, and every change
in SlideOps is planned, approved, executed, verified and recorded, however it was
started. The distinction is built in rather than left to whoever wrote the screen:
an action that changes something cannot run through the path that answers
questions.

### What each engine offers

|                           | PostgreSQL | MySQL and MariaDB | Redis                    |
| ------------------------- | ---------- | ----------------- | ------------------------ |
| Databases and their sizes | Yes        | Yes               | Keyspaces and key counts |
| What is connected now     | Yes        | Yes               | Yes                      |
| Export a copy             | Yes        | Yes               | No                       |
| Restore from a dump       | Yes        | Yes               | No                       |

Redis has no export, deliberately. A dump of a running Redis is either the whole
server's file, which does not belong to any one keyspace, or a key by key walk
that is not a consistent snapshot. A backup you believe in and cannot restore is
worse than no backup, so it is not offered.

Its keyspaces are called keyspaces rather than databases, because that is what
they are.

### Exporting

An export is a complete dump, streamed straight to you as it is produced. Nothing
is written to the server and nothing is left behind, so exporting a database
larger than the machine's spare disk is fine.

Use it to take a backup before something risky, to move onto a managed database
elsewhere, or to hand data to somebody.

### Restoring

Restoring happens in two steps, and the split is deliberate.

**First you upload the dump.** It goes to the server and nothing else happens.
Your database is untouched, and you can walk away. SlideOps tells you how many
bytes actually arrived, so you can check that against the file you meant to send
before going further.

**Then you approve the restore.** It is a normal Operation: you see the plan, what
will be replaced, what will be lost, and how it would be undone. Nothing runs
until you agree.

When it runs, a copy of the current database is taken first. That copy is what
makes the rollback real: if the restore fails, or if the result comes back empty,
what was there before goes back. The uploaded dump is removed afterwards, so a
complete copy of your data is not left sitting on the server.

### Scoped to the Service, not the server

A database server usually carries one database per application. Looking at it from
a Service shows only what that Service actually uses, and an export of anything
else is refused.

That is not a detail of the screen. The narrowing is done by the server, from the
Service's own configuration, so it holds however the request was made.

### Core and marketplace

The Capabilities every server gets are about the machine: its accounts, its
firewall, its packages, its SSH. They belong to the Node.

Everything from the marketplace is installed per Project, and used by the Services
in it. A database is a marketplace Capability, which is why its management is
scoped the way it is.
