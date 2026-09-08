# Domains and DNS

How a hostname gets attached to a Service, what record you have to create, and
how to tell which part of the chain is not working.

Everything about domains lives on one page, **Domains and DNS**. It used to live
in three, and none of them could answer the question, because a hostname that is
not working is a chain and the broken link is rarely on the page you started
from.

## A domain belongs to a Service, not to a Server

This is the rule everything else follows from.

A hostname points at an application, and the Server that application runs on
today is infrastructure it happens to be sitting on. So the binding is recorded
against the **Service**. When a Service is redeployed onto another Server, the
binding follows it. You never have to add your domain again because SlideOps
moved something.

It also means a hostname is claimed **platform wide**, not per Server. Only one
place can ever receive the traffic for `api.example.com`, so only one Service can
hold it. Claiming one another Service already holds is refused with
`hostname_taken` rather than creating two rows that both look right.

The consequence you will actually notice: choosing the Service also decides which
Server answers. There is no separate Server to pick, and the stepper says so
rather than leaving you hunting for a picker that does not exist.

## The guided flow

**Add a domain** walks six steps, in the order they actually happen. Four
separate things have to become true and only some of them are SlideOps' to do, so
each step says what it is about to do before it does it, and shows what really
came back afterwards.

Two rules hold it together. Nothing is applied without you pressing something. A
step that has not been satisfied does not open the next one, because carrying on
to request a certificate while DNS still points at somebody else's server
produces a failure that reads as SlideOps being broken.

### 1. Which Service is this domain for

Pick the Service. The Server follows from it. One Server can answer for as many
hostnames as you have Services on it, each with its own.

### 2. The name, and the port it listens on

The hostname on its own, with no scheme, no port and no path:

```text
api.example.com
```

Pasting a URL is a common and reasonable thing to do, and it is still not a
hostname, so it is refused with an explanation. So is a bare IP address: routing
by hostname needs a hostname, and a certificate authority will not issue for an
address.

The port is **the port your application listens on inside its container**, for
example `3000`. It is not a published host port. Visitors always arrive on
`443` whatever this is, so you never publish `3000` to the internet to serve
HTTPS on it.

Claiming the name records it and returns the exact record to create. **No port is
opened, no route is written, and no certificate is requested yet.** A hostname
that does not resolve has nothing to route and nothing a certificate authority
could validate.

### 3. Create the DNS record

The record comes back as separate fields, because a registrar's form is separate
boxes and handing you one line of prose is what makes people paste a whole
hostname into a field that wanted a label:

| Field | Example | Notes |
| --- | --- | --- |
| Type | `A` | Or `CNAME`, depending on what answers for your Workspace |
| Name | `api` | The label left of the zone. `@` when the hostname is the zone itself |
| Value | `198.51.100.10` | The address or name to point at |
| TTL | `Auto` | |

Each field has its own copy button.

### 4. Check what DNS actually answers

This is a **real lookup**, every time. A record in SlideOps' own table says only
that SlideOps was told about it; whether a browser can reach the hostname is a
question only a resolver can answer, and treating the two as the same is how a
page comes to say verified while the site is unreachable.

The result is always shown as expected beside found:

```text
Expected  198.51.100.10
Found     203.0.113.4
```

Resolving to the wrong place is a different problem from not resolving at all,
and it is the one you can fix right now. Not resolving yet is usually just
propagation, and the message says so.

Both record shapes are accepted, because both are correct depending on the
registrar: a `CNAME` at the target, or an address record that resolves to the
same address the target does. Insisting on one would refuse a correctly
configured domain.

This step stays open until a lookup answers with the value above. Nothing on any
Server changes when you check.

### 5. Routing and the certificate

**Put it live** opens the web ports on the Server, writes the route for **this
hostname alone**, and requests a certificate for it. Sites already served by that
Server are not touched. Full detail in [Certificates](/docs/connect/certificates)
and [Routing](/docs/connect/routing).

### 6. Confirm it serves the Service

The check that matters: a visitor typing the name reaches the application.

## Four readings, never one word

Every domain shows four separate readings, side by side. They stay four because
they fail separately and each has a different fix.

| Reading | What it answers |
| --- | --- |
| **DNS** | Does the world resolve this name to where it should, with expected and found always shown together |
| **Routing** | Has the Server been told to answer for this hostname |
| **Certificate** | Was one issued, and how long has it got |
| **Serving** | Does a visitor typing the name reach the Service |

A reading always carries the evidence it was derived from. "Not checked" is a
real answer; "healthy" when nobody has looked is not.

## The states a domain passes through

| State | Reads as | Meaning |
| --- | --- | --- |
| `pending_dns` | Waiting for DNS | Claimed, and DNS does not point here yet. The ordinary starting state, not a fault |
| `dns_verifying` | Checking DNS | A lookup is in progress |
| `dns_verified` | DNS points here | The world resolves this hostname to the right place |
| `routing_pending` | Setting up routing | The route is being written |
| `routing_active` | Routed | The proxy is routing the hostname to the Service |
| `tls_pending` | Getting a certificate | A certificate has been asked for |
| `active` | Serving | DNS, routing and TLS are all in place |
| `degraded` | Degraded | It was working and something needs attention, such as a certificate that did not issue |
| `failed` | Failed | A step did not succeed and needs somebody |
| `detached` | No longer served | Kept, but deliberately not routed |

They are separate because the fixes are different. Reporting all of them as
"failed" is what sends an Operator to a terminal, which is the work this is
supposed to remove.

## The one thing to do next

Each domain that is not serving offers exactly one action, chosen from its state,
with what it will do said before you press it:

- Waiting on DNS: **Check DNS now.** A real lookup. Nothing on any Server
  changes.
- Certificate failed: **Run provisioning again.** There is no separate
  certificate retry, because provisioning is what requests one. The wording says
  that plainly rather than offering a "Reissue certificate" button that is really
  something else.
- DNS verified, routing pending, failed or degraded: **Put it live.** Opens the
  web ports, writes the route for this hostname only, requests a certificate.
  Other sites on the same Server are left alone.

## What answers for your domains

Two arrangements, and the record you are given differs.

**Per Server**, the default. DNS points at the Server running the Service, as an
`A` record at its address. It needs nothing set up. Moving a Service to another
Server means changing its DNS record.

**One Workspace entry point.** One Server answers for every hostname in the
Workspace and forwards to whichever Server currently runs each Service, over the
[private network](/docs/infrastructure/private-network). DNS points at it once
and never moves again. It costs an entry point Server and makes that Server the
path for all public traffic, so it is opt in rather than the default.

If you point a stable name of your own at the entry point Server, your domains
become `CNAME` records at that name, and the address behind it can change without
touching any of them. Without one, they are `A` records at its address.

### Address drift on the entry point

This is the one thing that can quietly break every hostname in a Workspace at
once, and it is invisible without being told: the records are all still correct,
for an address the Server no longer has. The page warns explicitly when the entry
point Server's address has changed since your records were created.

Turning the entry point off leaves existing hostnames with the records they have,
because those point at a real Server that is still there. Rewriting them would
break exactly the sites you were trying to leave alone. New hostnames go back to
the per Server arrangement.

## Connecting DNS

You can connect the service that holds your DNS, per zone, with an API token.
Cloudflare is supported today.

The token is **verified against the zone before it is stored**, so a credential
that cannot manage it is refused now rather than failing later when somebody adds
a domain. A rejected token never reaches the secret store at all. It is kept
encrypted, is never returned by any endpoint, and is never shown again.

Give it permission to edit DNS for that one domain.

### The rule that makes this safe

A zone is somebody's whole internet presence. It holds their website, their mail
routing, the proof they own the domain for three different services, and a
handful of things nobody remembers adding but which something depends on. A
platform handed a token for that zone can trivially delete all of it, and the
mistake does not look like a mistake: it looks like tidying up before writing the
record it was asked for.

So the rule is narrow and absolute:

- SlideOps writes a record, **remembers exactly which record it wrote**, and
  afterwards will only ever modify or delete records it has that memory of.
- A record already at the name that SlideOps did not create is **reported and
  left alone**, with what is there, so you can decide. The existing record may be
  the one that matters and the new domain may be the mistake, and SlideOps cannot
  know which.
- Records of a different type that do not collide are ignored. A `TXT` proving
  domain ownership beside an `A` record is completely normal, and refusing the
  `A` because of it would block a correct setup for no reason. A `CNAME` is
  treated as colliding with anything, because a name with a `CNAME` cannot also
  have other records.
- The credential is scoped to its zone, checked twice: once when the connection
  is found, and again against the hostname itself, because a suffix match that
  was wrong would mean writing into a domain the credential was never given.
  `notexample.com` is not covered by `example.com`.

**Disconnecting** revokes the credential and leaves every record SlideOps created
exactly where it is. They are correct, the sites they point at are still serving,
and removing them because a credential was disconnected would take those sites
off the internet as a side effect of a permissions change.

Whether or not you have connected DNS, the exact record is always shown, and the
check that decides anything is the lookup in step 4.

Connecting DNS and choosing the entry point both need **Owner or Admin**. A zone
credential can rewrite where a company's mail goes, and being allowed to deploy
an application is not the same thing.

## Wildcards

A wildcard is accepted only as the leftmost label, which is the only place it
means anything:

```text
*.example.com
```

A wildcard cannot be looked up, because there is no name to ask about. Its
records are checked when a hostname under it is actually used.

## Removing a domain

Removing a hostname stops the Service answering on that name and frees the name
to be used again.

Only that hostname's own route is removed, so every other site on the same Server
keeps working. **No DNS record is touched**, so you may want to remove the record
at your registrar too. If SlideOps created the record itself, that is one of the
records it remembers and may remove.

The binding is released whether or not the Server could be reached. A Server that
is down must not leave you unable to give up a hostname; anything left behind on
it is reconciled the next time that Server is configured.

## Related

- [Certificates](/docs/connect/certificates)
- [Routing](/docs/connect/routing)
- [Services](/docs/build/services)
