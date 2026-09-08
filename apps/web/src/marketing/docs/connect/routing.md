# Routing

How several Services share one Server and one address with different hostnames
going to different applications, and what to do when the Server stops matching
what SlideOps intended.

## One Server, one address, many applications

A Server has one public address. That is not a limit on how many applications it
can serve, because requests carry the hostname the visitor typed.

A reverse proxy on the Server reads that hostname and forwards the request to the
right application:

```text
api.example.com     ->  127.0.0.1:3000   (the billing API)
app.example.com     ->  127.0.0.1:8080   (the web front end)
docs.example.com    ->  127.0.0.1:4000   (the docs site)
```

All three arrive on the same address, on port `443`. Each hostname has its own
route, and each route points at the Service's own port on **loopback**.

## Why the upstream is loopback

The proxy and the workload are on the same Server, so the container publishes its
port there and nothing outside the Server needs to reach it.

That is the whole point of the public port being `443` while the Service's port
stays private, and it is why you never have to publish `3000` to the internet in
order to serve HTTPS on it. When a domain is added, the port you give is the port
your application listens on inside its container, and visitors arrive on `443`
whatever it is.

## Adding a second Service to the same Server

Nothing special is required. Deploy the second Service, add its own hostname, put
it live. That writes **one more route** on the same Server, beside the routes
already there.

Provisioning is explicit about this: it opens the web ports if they are not
already open, writes the route for that hostname alone, and requests a
certificate for it. Sites already served by that Server are not touched.

Removing a hostname is equally narrow. It removes **that hostname's route**, and
nothing else. It is deliberately not the same thing as removing the proxy from
the Server: an Operator who wants one domain to stop answering should not have to
choose between a dead route and taking every other application on that Server off
the internet.

## Drift: what SlideOps intends against what the Server is doing

**Desired state** is the domains: this hostname belongs to that Service.
**Observed state** is the routes actually present on the Server. They can
disagree, and the interesting part is that they disagree in two directions with
two completely different answers.

### Missing routes are repairable

A hostname SlideOps believes is serving, with **no route on the Server**, is
drift. Something removed it: a rebuilt Server, a restored snapshot, or an edit by
hand.

This can be repaired, because SlideOps knows exactly what the route should be and
can write it again. The repair goes through the **ordinary provisioning path**
rather than writing route files by some other means. Two ways of writing a route
is how observed and desired state come to disagree in the first place, and a
repair that used a different one would be fixing drift with more of its cause.

Only the hostnames listed are written. Nothing else on the Server is changed or
removed, and it does not run until you press it. If one hostname cannot be
restored the others still are: a Server missing three routes should come back
with as many as can be restored, not stop at the first that will not.

A hostname still waiting on DNS has no route **by design**, so it is never
counted as drift. Otherwise every new domain would be reported as broken the
moment it was added.

### Unmanaged sites are left alone, deliberately

A route on the Server that no SlideOps domain claims is **not drift**, and
deciding what to do about it is not SlideOps' call.

It is far more likely to be something you set up before SlideOps existed, or
alongside it, than a mistake. Somebody who put a site on their own Server did not
ask for it to be tidied away.

So it is reported and left exactly where it is:

- Repair **never** removes an unmanaged route. A reconciler that decided a site
  it did not set up should stop being served would be the most destructive thing
  in the system.
- Unmanaged routes deliberately do **not** make a Server unhealthy. A Server that
  also serves something SlideOps did not set up is a normal Server, not a broken
  one, and saying otherwise would train you to ignore the panel.
- They are left out of the one line summary on purpose, which is worth saying out
  loud: a Server described as fully routed may still be serving these.

That list is also the inventory a migration needs, which is the same question
asked once rather than twice.

## Where to look

**On a Server's page**, the Domain routing section is read only. It answers "what
does this box actually answer for", which is a standing question about the
Server. It is not a scan you have to run.

Putting a route back is not offered there. That is one of four things that can be
wrong with a hostname, and doing it from the Server's page means doing it without
seeing the other three.

**On Domains and DNS**, the "Routing on your servers" section asks the same
question per Server that has domains on it, and offers **Put back the missing
routes** beside the rest of the chain.

The summary reads like this:

```text
Every domain SlideOps manages on this server is routed. 2 other sites are served here that SlideOps did not set up.
```

```text
1 domain is missing a route on this server.
```

### A Server that could not be read

A Server whose routes could not be read is **not** a Server with no drift, and
the panel says which it was. An empty, healthy looking box for a Server that
never answered would be the worst possible reading.

## Routing and the Server a Service runs on

Because a domain belongs to the Service, the binding follows the Service when it
is redeployed onto another Server. What follows automatically is SlideOps'
record of which Server should answer.

With per Server routing, **DNS is yours to change**: the record pointed at the
old Server's address, and it still does. The DNS reading will show expected
beside found, which is exactly the difference an Operator moving a Service hits.

## One entry point for the Workspace

The alternative arrangement puts one Server in front of the Workspace. It answers
for every hostname and forwards to whichever Server currently runs each Service,
over the [private network](/docs/infrastructure/private-network).

DNS then points at one place and never moves again, so a Service can be
redeployed onto another Server without anybody changing a record.

It is opt in, and the trade is stated rather than presented as a free
improvement:

- All public traffic for the Workspace passes through that Server, so it needs to
  stay reachable.
- It costs an extra Server. A Workspace with three Services on one Server does
  not need it and should not be made to run a second machine to get a domain.
- If that Server's address changes, every hostname in the Workspace is affected
  at once. The page warns when it has.

It only became possible when the private network did. Before that, an entry point
reaching a Service on another Server would have needed public ports and firewall
holes on every application Server, which is worse than the problem it solves.

Turning it off leaves existing hostnames with the records they already have, and
new hostnames go back to being answered by the Server running their Service.

## When routing is what is broken

The **Diagnose** panel on a Service checks, among other things, whether anything
is actually listening on ports 80 and 443 beyond loopback:

```text
Nothing is listening on port 80 and 443, so api.example.com cannot answer: a browser sent there times out. The Service is still reachable at its own port.
```

The fix it offers is to set up routing for that hostname again, which re-runs the
same Capability the deploy uses. It never changes the Server as part of the
check: Diagnose looks, and you press the fix.

A rediscovery of a Server also repairs this class of problem for the Services on
it. See [Servers](/docs/infrastructure/servers).

## Related

- [Domains and DNS](/docs/connect/domains-and-dns)
- [Certificates](/docs/connect/certificates)
- [Services](/docs/build/services)
