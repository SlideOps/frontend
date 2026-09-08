# Certificates

How a hostname gets a TLS certificate, what has to be true before one can be
issued, and what it means when the certificate is the only thing that failed.

A visitor reaching your Service by name arrives on `https`. The certificate that
makes that work is requested as part of putting a domain live, not as a separate
errand you have to remember.

## What has to be true first

A certificate is issued to a name, by an authority that verifies you control that
name by reaching it over the public internet. Three things therefore have to be
true before one can be issued, in this order:

1. **DNS resolves the hostname to the right place.** A name that does not resolve
   has nothing to validate against.
2. **Ports 80 and 443 are open on the Server.** The validation happens over port
   80. A route written on a Server whose firewall drops port 80 produces a
   hostname that reports itself configured and answers nobody: the browser times
   out and the certificate never issues.
3. **The route exists**, so the proxy is listening and can answer the challenge.

This is why provisioning refuses to start until a real lookup says the world
points here. That refusal is the difference between "waiting for DNS", which is
ordinary, and a failed certificate request that leaves rate limits and a
confusing error behind.

## What provisioning actually does

**Put it live** runs four steps, in this order, each as an ordinary Operation on
the Server:

| Step | What it does |
| --- | --- |
| Open port 80 | So a certificate can be issued at all |
| Open port 443 | So the hostname can be reached |
| Write the route | For this hostname only |
| Request the certificate | For this hostname |

Each step's failure is recorded on the domain in plain language and stops the
rest, because every later step depends on the one before it. A certificate for a
hostname with no route is useless, and a route on a Server whose ports are shut
is unreachable.

The failure messages name the actual problem:

```text
Port 80 could not be opened on this server, so a certificate cannot be issued for api.example.com.
```

## How the certificate is obtained

The mechanism is chosen from what [Discovery](/docs/infrastructure/servers) found
on the Server. You do not choose it and you do not need to know which one ran;
the plan will tell you before it does.

**Caddy** is preferred, and it is the reverse proxy SlideOps installs. Caddy
handles HTTPS automatically for any domain in its configuration, so the
Capability's work is to make sure the domain block exists, set the account email
for certificate notices if one was given, and reload.

**certbot** is used when NGINX is the web server and Caddy is not present. The
Capability installs certbot and its NGINX plugin from the Server's own package
source, then obtains a certificate for the domain non interactively and lets
certbot configure NGINX to redirect to HTTPS.

Verification afterwards confirms a certificate is actually present for the
domain, rather than assuming the command that ran meant it worked.

## Renewal

SlideOps does not run renewals on a schedule of its own. The certificate
machinery on the Server does that, and it is the ordinary arrangement for
whichever path was taken: Caddy renews automatically for the domains in its
configuration, and on the certbot path renewal is certbot's own, on the Server.

The one thing that matters to you is a firewall rule:

> **Keep port 80 open.** Port 443 is where the traffic goes, and port 80 is where
> a certificate is renewed from. A Server with only 443 open keeps working right
> up until the day the certificate expires, and then stops.

This is also why provisioning opens both, and why the **Diagnose** panel on a
Service checks both.

## Reading the certificate state

The Certificate column on **Domains and DNS** reads one of:

| Reading | Meaning |
| --- | --- |
| **Not needed** | This hostname does not require one |
| **Being issued** | A certificate has been asked for |
| **Issued** | One was issued. Where an expiry is recorded, the date is shown beneath |
| **Expires in N days** | Within the renewal window, so worth looking at before it lapses |
| **Expired** | The certificate has lapsed |
| **Failed** | No certificate was issued, with the reason |

The renewal window is 14 days: close enough to expiry to be worth pointing at,
while still leaving room to fix a renewal that is not happening.

"Issued" with no expiry date beneath it means exactly that: a certificate was
issued and no expiry was recorded against the domain. It is not a claim that the
certificate is valid forever, and SlideOps does not assert a validity it was not
told.

## What a failed certificate means

A certificate that did not issue leaves the domain **degraded**, not failed. That
distinction is deliberate:

> The route is in place, so the site answers, but not over https yet.

Routing exists and works over `http`, and calling that "failed" would understate
what is already serving. The four readings stay separate for this reason: DNS
green, Routing green, Certificate red, Serving amber tells you precisely which of
four things to go and fix.

Common causes, in the order worth checking:

- **DNS points somewhere else.** The certificate authority reached a different
  server than yours. The DNS reading shows expected beside found.
- **Port 80 is closed.** The challenge could not reach the Server. The step's own
  failure message says so.
- **The hostname is not reachable from the internet at all.** A Server behind
  something that is not forwarding 80 and 443 cannot be validated.
- **Rate limits.** Repeatedly requesting a certificate for a name that cannot be
  validated will eventually be refused by the authority for a while. This is why
  provisioning checks DNS first rather than letting you try.

## Retrying

There is no separate certificate retry, and the interface says so rather than
offering a button that is really something else. **Run provisioning again**:
it opens the web ports, rewrites the route for this hostname, and asks for the
certificate once more.

Running it again is safe. The route is written for this hostname alone and other
sites on the same Server are left exactly as they are.

## Certificates SlideOps did not issue

Discovery reports the certificates it finds on a Server, including whether
Let's Encrypt material is present and the names on the certificates it sees.

Those are reported, not adopted. A certificate you obtained yourself for a site
SlideOps did not set up is your work, and nothing in SlideOps will renew it, move
it, or remove it. The same principle applies to the routes beside them: see
[Routing](/docs/connect/routing).

## Related

- [Domains and DNS](/docs/connect/domains-and-dns)
- [Routing](/docs/connect/routing)
- [Firewall and database access](/docs/connect/firewall-and-database-access)
