# Troubleshooting

Real failures, what actually causes them, and what to do. Each entry quotes the message you will see, because that is what you have in front of you when you come looking.

## Where to look first

Three places, in this order:

1. **The Service page.** A failed deploy leaves its reason on the page, so you do not have to have been watching the live stream.
2. **The Logs tab**, which holds the live output, the **Diagnose** panel, and the Service's own activity trail. The trail is where you find out that somebody changed three environment variables nine minutes before this broke.
3. **History**, for anything that ran as an Operation. Every Operation keeps its plan, its full output, and its verification evidence, and you can replay it exactly.

## Connecting to a server

### "the connected account cannot run privileged commands on this node"

> the connected account cannot run privileged commands on this node (sudo refused it); switch to an account with sudo access, or grant sudo to this one, then deploy again

The account SlideOps connects as cannot use `sudo`. This is deliberately a different message from "not installed", because the two have completely different fixes and being told the wrong one wastes an afternoon.

Either give that account sudo on the machine, or rotate the Node's credential to an account that has it, from the server's Settings tab.

### The server is unreachable

Deploys and Operations that cannot reach the machine come back as `502`, described as a server you own that could not be reached.

Check the obvious things in this order: the machine is up; the address and port on the Node record are still correct; the machine's own firewall or provider firewall still allows SSH from wherever the SlideOps backend runs; the credential has not been rotated on the machine behind SlideOps' back.

Preflight and Diagnose both start with reachability, so running either gives you a definite answer rather than an inference.

### A shell or log stream closes immediately

A refusal that happens after the WebSocket upgrade arrives as an error inside the socket and then a close, because a browser cannot read the status of a failed handshake. Common causes: the Service is not running, the session expired, or the machine's host key changed.

A changed host key is worth taking seriously. SlideOps pins the host key on first use, so a change means either the machine was rebuilt or something is answering that is not your machine.

## Signing in

### "Your session has expired. Sign in again."

A `401`. The session cookie is gone or no longer valid. Sign in again; the session lasts thirty days and rolls forward every time it is used, so this normally only happens after a real absence, a sign out elsewhere, or a password change.

Changing your password ends every other session for the account on purpose, keeping only the one you changed it from.

### "too many attempts, try again later"

A `429`. Sign in is rate limited to ten attempts per email and client IP within fifteen minutes. Nothing else in the API is throttled.

Wait it out. If you are locked out of an account you administer, an admin can inspect and clear the limit.

### The two step code is refused

The challenge issued at sign in is **single use and expires after five minutes**. If you took longer, start the sign in again to get a fresh challenge rather than retrying the code against the old one.

### "your role in this workspace is read only"

A `403` with the code `read_only_member`. You are a Viewer in the Workspace you are currently acting in.

Two things to check: you may be in the wrong Workspace, so try the switcher; or you genuinely need a higher role, which an Owner or an Admin can grant.

## Operations

### "no provider supports this capability on this node"

A `422`. The Capability exists, but nothing knows how to carry it out on that machine's platform.

Usually this means Discovery has not run, or ran before the machine was what it is now. Run the quick check again so the facts are current, then retry. If the platform genuinely is not one SlideOps has a Provider for, the Capability is not available there.

Note that the Provider is chosen twice, once at planning and once again from freshly gathered facts at execution. A machine that changed underneath a plan can fail the second check even though the first passed.

### "complete X first: it has not completed on this node yet"

A `409`. The Capability depends on another one that has not been done on that machine.

The message names what to do first. Server security in particular is offered as an ordered pipeline on the server's page, so a step is never offered before what it needs; work down that list.

Some prerequisites are satisfied by detection rather than by a recorded Operation, so a thing you did by hand before connecting the server counts.

### "this capability comes from a plugin that is not installed in this project"

A `403`. The Capability is unlocked by a Plugin, and that Plugin is not installed in this Project.

Open the Project's **Stack** tab and install it. If instead you see a `400` about a Project being required, you started the Capability at the server level when it needs a Project's context; start it from the Project's Capabilities tab.

### "the operation is not awaiting approval"

A `409`. Something already moved the Operation on: it was approved elsewhere, or it was cancelled. Reload and look at its current status.

### An approved Operation is not running

Two holds can keep an Operation sitting at `approved`, and both say so on the Operation:

- **Executions are paused platform wide.** The Operation is queued and will run when executions resume.
- **The account is suspended.** The Operation is on hold until the account is restored.

Nothing is lost in either case. The Operation stays on the queue.

A `503` with the code `emergency_hold` on a request that changes something is the same situation seen from the API side.

### Verification failed

This is not a surprise state; it is part of the lifecycle.

When verification does not pass, the plan's rollback runs automatically and the Operation is recorded as `failed`. Open it and read the checks: each one names what was expected and what was actually read back, which is normally enough to identify the cause without any guesswork.

The check named **a fresh connection still authenticates** is the one that matters most. If that failed, the change would have cut off your access, and it was undone.

### "the operation was interrupted by a restart and did not complete"

The API restarted while the Operation was in flight. The process that would have performed a rollback is gone, so the Operation is marked failed with this reason and **no rollback is claimed**, because none ran.

Check the event log to see how far it got, then decide whether to run it again.

### An Operation stopped after 45 minutes

> this Operation was stopped after 45m0s without finishing, so it was not left running indefinitely. Nothing further was changed after that point.

An Operation that has not finished within forty five minutes is stopped rather than left running forever. The record keeps the last thing it reported, which is where to start looking.

### "Rollback did not complete cleanly."

The rollback ran and hit a problem of its own. The most common reason is that there was no backup to restore, which happens when the Operation failed before it got as far as taking one.

Read the event log to see how far the original execution went. The machine is in whatever state that log describes, and the log is a complete record of the commands that were run.

## Deploying

### "docker is not installed on this node"

> docker is not installed on this node; apply the Enable Containers Capability first

Install it through the Capability rather than by hand, so the Node's facts and the Project's stack both know about it. Preflight catches this before you deploy.

### "docker compose is not installed on this node"

> docker compose is not installed on this node; apply the Install Docker Compose Capability first

Same shape, different Capability.

### "no docker compose file was found in this repository"

The Compose runtime was chosen, the repository was cloned, and there is no compose file in it. Either the file lives on a branch you are not deploying, or this Service should be a plain container.

### "a compose service must come from a repository"

A Compose stack is described by a file, so it cannot come from an image. Switch the source to a repository, or switch the runtime to a container.

### "no Dockerfile found"

Two variants, and the difference tells you the fix:

> no Dockerfile found in "apps/api": this Service's build subdirectory is set to "apps/api", but the repository has none there

The subdirectory is wrong. Correct it on the Service's Settings tab.

> no Dockerfile found at the root of this repository: if it lives in a subdirectory, set the build subdirectory to it

You have a monorepo and did not set the subdirectory. Set it.

### "The container started and then exited."

The deploy got as far as starting the workload, and it stopped on its own. This is your application failing, not SlideOps failing.

The container's own last output is included as the reason, because it is exactly the line you would have gone to a terminal to read. Where the container produced nothing at all, the message says that too rather than implying there was output you missed.

Common causes: a missing environment variable, an entrypoint that is not executable, a port already bound inside the container, a database it could not reach at startup.

### "The container started, then crashed and is stuck restarting."

A crash loop. Containers run with `--restart unless-stopped`, so a failing application restarts, fails, and restarts again. SlideOps waits a few seconds after starting and looks again, so this is caught rather than reported as a successful deploy.

Same causes as above. The Logs tab and the Diagnose panel are the fastest route.

### The application cannot resolve "postgres" or "redis"

You deployed a repository that contains a compose file as a **single container**. SlideOps warns about this during the deploy:

> This repository includes docker-compose.yml, so it expects other containers alongside it, but this Service is a single container: a hostname like "postgres" or "redis" will not resolve.

Two real fixes, both offered in the message: deploy it with the **compose** runtime so the whole stack runs as the file describes and Compose makes the network; or install what it needs as Capabilities and point its environment at those.

### "git is not installed on this node"

A repository source needs Git on the machine, both to build and to check for updates. Install it through the Manage packages Capability.

### "no free host port is available on this node"

> no free host port is available on this node between 20000 and 29999

SlideOps allocates public ports from a dedicated range. Exhausting it means a great many Services, or a great many that were never cleaned up. Remove Services you no longer run, or pin the public port yourself with `host:container`.

### "another service on this node already answers on that domain"

Two Services on one machine cannot both own a hostname. Change one of them.

### "the free tier allows at most 1 projects"

A `403` with the code `quota_exceeded`, naming the limit you hit. Tiers bound Workspaces, servers, Projects, and seats.

They do **not** bound CPU, memory, disk, or the number of Services on a server. If a deploy is being refused, it is because you are out of Projects or Nodes, not out of Services.

### The deploy worked but the hostname does not answer

> Routing finished, but nothing is listening on 80 and 443 on this node yet, so example.com will not answer. The Service is running and still reachable at its port.

Routing is best effort and it runs **after** the Service is marked running, so a routing problem never fails a deploy that otherwise worked. The Service is up; only the name in front of it is not.

Check that a reverse proxy Capability is actually in place on the machine, and that ports 80 and 443 are open. Diagnose checks exactly this and offers the fix.

### "this service publishes no port, so there is nothing to give an address to"

A worker with no listening port cannot be given a web address. That is correct behaviour, not a bug.

## HTTPS and certificates

### "no trusted certificate yet; [it] is serving its own internal, browser-untrusted certificate"

> no trusted certificate yet; Caddy is serving its own internal, browser-untrusted certificate

Not a failure by itself. The reverse proxy issues itself a certificate the instant a domain is configured, purely so it has something to serve while it requests a real one, and it keeps using that internal one for as long as the real request keeps failing. This is what a browser is reacting to when it calls a freshly configured domain insecure.

The Operation can report success — the domain is routed, the proxy is running — while this one check stays red, because a real certificate depends on two things entirely outside the machine's own configuration: DNS actually pointing at this Server, and the public internet actually being able to reach it on ports 80 and 443. Neither is something an Operation can make true by retrying.

Give it a minute after DNS first points here; issuance is asynchronous and usually finishes within a minute or two. If it is still on the internal certificate after that, check, in this order:

- **DNS** actually resolves the hostname to this Server's address, not a CDN or an old address.
- **Port 80** is reachable from the public internet. This is what the validation itself travels over, and a cloud firewall or security group that only opens 443 looks fine to a browser and fails silently here.
- **Nothing else is already bound to 80 or 443** on the Server.

See [Certificates](/docs/connect/certificates) for what has to be true before one can be issued at all.

If you turned on **Use a DNS challenge via Cloudflare** for this domain, the check reads slightly differently: it persists if the Cloudflare token cannot manage this domain's zone, not if ports 80/443 are unreachable. Check the token is scoped to the right zone (Zone → DNS → Edit, on the zone the domain is actually in) and has not been revoked, from [Domains and DNS](/docs/connect/domains-and-dns).

### "the domain's site block does not carry the DNS challenge; run this Capability again to add it"

Only seen with **Use a DNS challenge via Cloudflare** on. Unlike the trusted-certificate check above, this one is fully within the Capability's own control — it is a file it just wrote — so it fails the Operation outright rather than being reported as a check to watch.

The one common cause: **Configure Reverse Proxy** ran again for this domain after HTTPS was configured with the DNS challenge (pointing it at a different upstream, say), and the route rewrite lost the challenge along with it. Configure HTTPS again to put it back — the reverse proxy Capability now carries an existing DNS challenge forward when it rewrites a route, so this should not recur for the same domain, but did on any run from before that.

## Configuration and environment

### The change I saved is not taking effect

Almost always this. A container bakes its environment, command, ports, and source in when it is created, so:

> **Saved, but not yet running.** The container is still the one built from the previous configuration until you redeploy.

Press **Redeploy to apply**. See [Environment and secrets](/docs/build/environment-and-secrets).

Note that Restart is not enough. A restart is the same container with the same environment it was created with.

Resource limits are the one exception: they apply in place with no rebuild.

### "this service's configuration changed after this editor was opened"

A `409` with the code `config_changed`. Somebody else, or you in another tab, changed the environment while your editor was open.

Reload, look at what is actually there now, and make your change again. This refusal matters more than usual because a save writes the whole environment: applying a stale one would not merely lose the field in your hand, it would reinstate every other variable as your stale copy remembered them.

### "a variable with that name already exists on this service"

A `409` on a rename. Renaming onto an existing name would replace a value you did not name, so it is refused. Choose another name, or edit the existing variable directly.

### "this service has no environment variable with that name"

A `404` on a rename or an edit. The variable moved or was removed since your view was loaded. Reload to see the current environment.

### "an environment variable name cannot be empty and cannot contain an equals sign, whitespace, or a newline"

A `400`. Those are the only names refused. SlideOps deliberately does not enforce the conventional `[A-Za-z_][A-Za-z0-9_]*`, because the name is read by your application, not by SlideOps.

The deploy form's textarea is stricter than the server, so a name it rejects may still be acceptable through the Service's own editor.

### A secret came back empty when I edited it

That is correct, and it is the honest thing to show. A sealed value cannot be read back, so the box starts empty rather than seeded with the `[stored securely]` marker. The marker is not the value, and saving it would store those literal words as your variable.

**Leaving it empty keeps what is already there.** Only typing over it replaces it, and only deleting its line in the full editor removes the variable.

### I lost a secret when I added a variable

The full editor **replaces** the whole set. A variable you leave out is removed, and a sealed value you do not resend goes with it.

Use the per-row **Edit** for a single change: that request names one key and carries one variable, so nothing else can be lost by omission.

### "this systemd service has no command recorded"

A `409`. A systemd Service **is** its command, so its configuration cannot be saved without one. Fill the command in.

### "this service was already running when slideops adopted it"

An adopted workload cannot have its source or ports edited, and cannot be redeployed, because SlideOps did not build it and has nothing to rebuild it from. Its command and environment can be saved, but applying them means recreating the workload yourself.

## Services

### Redeploy is not offered

Three reasons, all of them permanent for that Service: it is **adopted**, it has been **removed**, or it is a **Capability Service** with no single workload to rebuild. See [Redeploying and rollback](/docs/build/redeploying-and-rollback).

### "This image contains no shell, so there is nothing to enter."

Normal for a distroless or scratch image. SlideOps probes for `bash` and falls back to `sh`; if the image has neither, there is genuinely nothing to open.

Use the server's own terminal instead, or the Logs tab.

### The shell says the Service is not running

A shell is only offered while there is something running to enter. Start the Service first.

### Delete forever will not enable

You have to type `delete <the Service's name>` exactly. A checkbox is not enough for something that cannot be undone, and the field is matched literally.

### A Service that was fine has stopped working

Run **Diagnose** from the Logs tab. It checks the things that break *after* a good deploy: a crash-looping container with its own last output, a dependency that is no longer reachable from that machine, a hostname with nothing listening to answer it. Where a check has a fix, applying it from there is a normal Operation with a plan you approve.

The same checks run in the background every ten minutes and record changes, not states, so the activity trail will already show when it stopped working, and when it recovers.

## Celery workers

### "ModuleNotFoundError: No module named 'app'"

This is the exact failure that started this whole area of SlideOps existing: Redis was healthy, the API could enqueue jobs, and nothing was consuming them, because the working directory a worker was started from was not the application's own.

The **working directory** on Configure Celery worker has to be the application's own root — where its Python environment and its `celery_app` object actually live, not SlideOps' own directory. Use **Scan** on the Celery section of the Service's Capability page to find it and a candidate application automatically, rather than typing it from memory.

Every check this page runs, before you approve anything, imports the application exactly the way the worker itself would. A wrong working directory fails the same way here as it would by hand, with the same traceback — nothing is hidden or generalised into "the worker failed to start."

### "celery preflight failed: ..."

Configuring or starting a worker refuses outright when any of the checks it runs first do not pass — never starts something it already knows will not work, and never a generic failure: the message names which check and carries its real error text.

Run **Preflight** (the "Check this configuration" button) on the same page before approving anything. It runs the identical checks Configure itself runs, so whatever it finds is exactly what would otherwise fail the Operation.

### "the working directory ... does not exist on this node"

Either the path is wrong, or it is a path on a different Node than the one this Service is actually configured against — Redis and the application do not have to be on the same machine, and the worker always has to be configured from the application's own.

### The broker check fails

> ConnectionRefusedError: [Errno 111] Connection refused

The broker URL is unreachable **from the worker's own Node**, checked by connecting from there, not from SlideOps' own servers. If Redis is on a different Node than the application, confirm the address in the broker URL is one the application's Node can actually reach — its private address, not `localhost`, unless Redis genuinely runs on the same machine.

### "not tested: no result backend is configured, so a task's completion cannot be read back"

**Send a test task**, on the worker's own page once it is configured, sends a real task through the broker and waits for the result backend to confirm it finished — the one thing a worker merely answering a ping does not prove. Without a result backend configured there is nothing to read that confirmation back from, so the check says so honestly rather than reporting a false pass. Set a result backend to use it.

### A worker is configured and active, but nothing it processes ever finishes

Two different, real causes look identical from the outside, and the Celery section on the worker's own page separates them:

- **Queue depth** shows tasks piling up in the broker's own queue with nothing active — a worker that stopped consuming, even though its process and its systemd unit are both still running.
- **Task routing** shows the application's own `task_routes`, exactly as configured. If a task is routed to a queue this worker was never configured to consume (the **Queues** field on Configure), it will never be picked up by this worker, no matter how healthy everything else reads.

### "an unmanaged Celery worker is already running and answering for this application"

Preflight found a worker answering for this application that SlideOps does not manage — started by hand, or by something else entirely. Configuring here creates a separate, supervised unit alongside it; **it is never stopped automatically**. Stop the existing process yourself first if you want this configuration to fully replace it, or leave both running if that is genuinely what you want, but decide on purpose rather than by accident.

### Stopping a worker did not wait for its current task

An ordinary stop is a warm shutdown: it waits for whatever the worker is mid-execution to finish, up to systemd's own stop timeout, before the process actually ends. Only **Force stop immediately** ends it right away, at the cost of losing that task outright rather than merely delaying it. If a stop ended a task you expected it to finish, check whether Force stop was the one used.

### "this node's init system is not systemd, which a supervised celery worker needs"

Celery worker management in SlideOps is systemd only for now; OpenRC (Alpine) is not supported.

## The app itself

### "The server does not have this endpoint."

> The server does not have this endpoint. It is most likely running an older build than this app: rebuild and restart the API.

The frontend and the API are out of step. This is a deployment problem rather than anything you did.

### "The server could not be reached."

> The server could not be reached. Check it is running and that the API address is correct.

The request never got an HTTP response at all. The API is down, or a development proxy has nothing behind it.

### Cross origin requests are failing silently

If the app is served from a different origin to the API, that origin must be named in the API's `CORS_ALLOWED_ORIGINS`. The allowlist is exact match, never a wildcard, because the session cookie is a credential.

Configuring it also switches the cookie to `SameSite=None; Secure`, which means both sides must be HTTPS for a browser to send it at all. Half-configured, this looks exactly like being signed out.

### "Live progress" is not connecting with EventSource

It is a WebSocket, not Server-Sent Events, despite what some of the generated API reference says. Open it with `new WebSocket(...)`. See [API reference](/docs/reference/api).

## Where to go next

- [How an Operation works](/docs/start/how-an-operation-works) for what each stage does and why a failure looks the way it does.
- [Deploying](/docs/build/deploying) for the deploy sequence.
- [API reference](/docs/reference/api) for the error envelope and the full list of status codes.
