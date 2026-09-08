# Deploying

Getting a workload onto a server is two separate choices: **where the workload comes from**, and **how it runs on the machine**. They combine, and the combination decides what SlideOps can do for it afterwards. This page covers both, plus what happens during a deploy, adopting what is already running, and deploying automatically.

If you want the steps rather than the map, start with one of the two step-by-step guides below.

## Which guide do you need?

Nearly every first deploy is one of two shapes, and one question tells them apart.

**Open your application's configuration and look at the addresses it points at.**

| What you find | Deploy it as | The guide |
| --- | --- | --- |
| Bare names such as `postgres`, `redis`, `nats` or `clamav` | A Compose stack | [Deploying a Compose stack](/docs/build/deploying-a-compose-stack) |
| Real addresses, or connection details a Capability gave it | A single container | [Deploying with a Dockerfile](/docs/build/deploying-with-a-dockerfile) |

Those bare names are what the other services in a compose file are called. They resolve only on the network Compose builds for a stack. A single container joins Docker's default bridge with nothing else on it, so there is nobody there called `postgres`, and an application configured that way fails at startup every time.

If you are unsure, read the opening section of either guide. Each one begins by ruling itself out.

The rest of this page is the reference behind those two: every source, every runtime, what actually happens during a deploy, and the cases neither guide covers.

## Where it comes from

### From a repository

Point SlideOps at a Git repository and a branch. The first deploy clones it shallow, builds it, and runs it. Every redeploy fetches that branch and resets the checkout to its head, so it never re-clones and always takes the newest code.

SlideOps records the commit it built from, so an update check can compare it against the remote head and tell you whether there is anything waiting. A deploy is never a guess about whether anything changed.

Private repositories need GitHub connected, on the Project's Overview tab. A public repository can be cloned by URL without it.

The build looks for a `Dockerfile`. If your application lives in a subdirectory of a monorepo, set the subdirectory on the deploy form, and the build happens there. If there is no Dockerfile where it looked, the deploy fails with a message saying exactly where it looked and what to do about it.

This is the fullest option. SlideOps knows how the workload was built, so it can rebuild it and tell you what changed.

### From an image

Give SlideOps a container image that already exists and it runs it. Nothing is built.

This suits anything published to a registry, and anything whose build happens somewhere else. An image can be moved to a new tag, but SlideOps cannot tell you what changed inside it.

### Adopted

The workload was already running on the server when SlideOps found it. Somebody deployed it by hand, or it predates SlideOps entirely, or it came from another account.

See [Adopting what is already running](#adopting-what-is-already-running) below.

## How it runs

### A container

One container, with hard limits on CPU, memory, and processes. The most common choice and the one with the most management available. Step by step: [Deploying with a Dockerfile](/docs/build/deploying-with-a-dockerfile).

It is removed and recreated on every deploy, which is why a configuration change here always takes effect with nothing to remember.

Docker must be installed on the server. If it is not, the deploy is refused with a message telling you to apply the Enable Containers Capability first, rather than failing obscurely partway through.

### A Compose stack

Several containers described by a compose file in your repository: an application, its database, its cache, whatever it declares. SlideOps reads the file and runs the stack. Step by step: [Deploying a Compose stack](/docs/build/deploying-a-compose-stack).

Because a stack is described by a file, **this is only available from a repository**. An image alone cannot describe one, and the deploy is refused with that as the reason.

Docker Compose must be installed on the server, and the repository must actually contain a compose file. Both refusals name what is missing.

If you deploy a repository that contains a compose file as a *single container*, SlideOps warns you during the deploy rather than letting you find out later, and names the two real options: deploy it as a Compose stack, or install what it needs as Capabilities and point its environment at those.

### A systemd service

No container at all. A command, run and supervised by the machine itself, with resource limits enforced through cgroups.

For workloads that should not be containerised, and for servers where Docker is not wanted.

A systemd Service **is its command**. SlideOps writes a unit whose `ExecStart` is what you typed, with `Restart=always`, the CPU quota, the memory ceiling, the task ceiling, and the environment. It does not clone a repository and it does not build an image for a systemd Service, so whatever the command points at has to already be on the machine. The command is required, and a later configuration save that would leave it empty is refused.

## What combines with what

|                       | Container | Compose stack            | systemd service |
| --------------------- | --------- | ------------------------ | --------------- |
| **From a repository** | Yes, cloned and built | Yes, the stack is the file | The source is recorded, but nothing is cloned or built |
| **From an image**     | Yes       | No, a stack needs a file | The image is not used; the command is what runs |
| **Adopted**           | Yes       | No, a stack cannot be adopted | Yes |

## What happens during a deploy

Pressing Deploy creates the Service immediately at `deploying` and returns. The work runs in the background and streams as it goes, so you can watch it or walk away.

In order:

1. **The address is settled first.** The hostname and the published ports are decided before anything is built, because a container bakes its port mapping in when it is created and the hostname is what the outside world will be told.
2. **Sealed environment values are revealed**, in memory, to this deploy only.
3. **The source is brought to the machine.** A repository is cloned or fetched and reset to the branch head. An image is pulled.
4. **The image is built**, for a repository source.
5. **The workload is started.**
6. **It is checked.** SlideOps waits a few seconds and looks again. A container that started and immediately exited fails the deploy, with the container's own last output as the reason, or a clear statement that it produced no output explaining why. A container stuck restarting is reported as a crash loop rather than as a success.
7. **The port is opened on the firewall**, so the Service is actually reachable rather than running behind a closed door.
8. **The deployed commit is recorded.**
9. **An address is put in front of it**: the firewall is opened for HTTP and HTTPS, the hostname is routed, and a certificate is requested. Each of those steps is an ordinary Capability, so it is planned, executed, verified, and recorded in History exactly as if you had run it by hand.

Step 9 is best effort and runs **after** the Service is marked running. If routing does not work out, the Service is still running and still reachable at its port, and the failure is recorded on the Service rather than pretending the deploy failed.

### Preflight

Before you deploy, **Run preflight** connects to the chosen server read-only and reports what a real deploy would run into: an unreachable server, a missing runtime tool, a port already taken, resources tighter than you asked for.

It changes nothing, and it does not block Deploy. Where a check has a fix, applying it from there is a normal Operation with a plan you approve.

Use it. A firewall dropping traffic is worth finding when the check finds it, not after a deploy has proved it again.

### Cancelling a deploy

While a deploy is in flight, **Cancel this deploy** is the only lifecycle action offered, because the others have nothing settled to act on.

Cancelling **stops the work, it does not undo it**. A build that had begun is abandoned; whatever the previous deploy left running on the server is untouched. That is exactly why it is a separate thing from removing the Service.

## Adopting what is already running

If a server was doing real work before SlideOps saw it, that work is found and listed: containers, Compose stacks, NGINX sites, databases. Use **Import what is running** from the Services list, or the server's own page.

**Adopting changes nothing.** It starts nothing, stops nothing, and rebuilds nothing. The workload keeps running exactly as it was, and SlideOps starts holding a record of it so it appears in the Project alongside everything else, with its status, its logs, its terminal, and its resource use.

This is how a server with years of history joins the platform without a migration.

### What is offered

Containers, and systemd units you own. Distribution units and units SlideOps itself installs as Capabilities are filtered out, so the list is what you actually deployed rather than the whole machine.

A Compose stack cannot be adopted as a Compose Service.

### What adoption cannot do afterwards

Because SlideOps did not build it, there is nothing to rebuild it from:

- **It can never be redeployed.** The action is not offered and the API refuses it.
- **Its source and its ports cannot be edited.** Its command and environment can be saved, but applying them means recreating the workload yourself.
- **It is never routed or exposed.** Rerouting it would be SlideOps changing something it did not set up and was not asked to change.
- **Removing it releases it**, rather than tearing down something SlideOps never created. It keeps running on your server and simply disappears from SlideOps.

Everything that reads the machine works fully: status, logs, terminal, resource use, monitoring, and a place in the Project.

### Environment variables on adoption

This is the one place SlideOps guesses which variables are secret, and it is worth knowing why.

Normally SlideOps never guesses. You mark a value secret with the `secret:` prefix, knowingly, because it is your infrastructure and guessing is wrong in both directions: it either fails to recognise something and leaves it in the open, or quietly makes a value you needed unreadable.

On adoption there is nobody to ask. So anything that reads like a credential is sealed on the way in: by name, if it contains something like `PASSWORD`, `SECRET`, `TOKEN`, `API_KEY`, `PRIVATE_KEY`, `CREDENTIAL`, or `AUTH`; or by value, if it looks like a connection string with a password inside it, such as `postgres://user:pw@host/db`. A variable named `DATABASE_URL` says nothing secret, and its value is a password.

A non-secret sealed by mistake is a small inconvenience. A secret left in the clear is not.

Runtime noise from the image is dropped rather than carried over: `PATH`, `HOSTNAME`, `HOME`, `LANG`, language version pins, and the like.

The workload listing tells you **which variables will be sealed before you adopt**, because sealing is irreversible and you should see it coming.

## Deploying Capabilities as a Service

The other half of the deploy chooser. Instead of an application, you pick infrastructure your Project depends on, such as PostgreSQL and Redis, and they are deployed together as one named Service.

Each Capability runs as its own real Operation, planned, executed, verified, and recorded in History. They do not depend on each other, so one failing does not stop the rest: the Service ends up running with whichever succeeded, and the failure names whichever did not.

You grow it later with **Add a Capability** rather than by redeploying it. Reconfiguring one that is already there is that Capability's own Configure action.

## Deploying a Compose file as Capabilities

When you choose a repository and the Compose runtime, SlideOps can read the compose file and plan it as Capabilities instead.

A compose file already says what you want. `image: postgres:16` means a PostgreSQL server, a database, and an account for your application, so rather than making you install it by hand and copy a password into the environment, SlideOps shows the plan that does all three and wires the credentials through.

It plans and stops. Nothing touches a server until you read what would happen and approve it. Every provisioning step then runs as its own Operation, recorded in History, and a failure stops the run rather than continuing past it.

## Automatic deployment

The Service's **CI/CD** tab. Off by default.

There are two build modes, and they answer different questions.

### SlideOps builds it

A push to the deployed branch redeploys the Service.

Where SlideOps can register a GitHub push webhook, the redeploy happens as soon as you push. Where it cannot, a periodic check picks the change up within a few minutes instead. The tab says plainly which of the two is actually running, rather than leaving you to wonder why a push did nothing for four minutes.

### An outside CI builds it

Your own pipeline builds the image and tells SlideOps to deploy it. Two ways in:

- **The deploy hook**, called with an image reference.
- **An artifact upload**, for a tarball.

Both authenticate with a bearer token this tab issues. The token is shown **once**, at the moment you rotate it, and cannot be read back afterwards. Rotate again to replace it. This is the only bearer token in the product, and it is scoped to one Service.

You can also configure a registry URL, username, and password here for a private registry. The password follows the same rule a sealed environment value does: omit it to leave the stored one untouched, send an empty string to clear it, send anything else to replace it.

### The deploy events trail

Whichever mode you are in, the tab lists the recent deploy attempts: what triggered each one (a push webhook, the periodic check, the deploy hook, an artifact upload, or a manual deploy), what commit or image it was, and what happened (a redeploy started, it was skipped, or it errored, with the detail).

This is what explains a skipped or failed automatic deploy once a webhook, rather than a click, is what starts one.

## Why the choice matters afterwards

The method decides how much SlideOps can do for the workload later.

- **From a repository** is the only one where SlideOps can rebuild from source, so it is the only one where a redeploy means "take the newest code".
- **From an image** can be moved to a new image tag, but SlideOps cannot tell you what changed inside it.
- **Adopted** is fully managed for everything that reads the machine and cannot be rebuilt at all.

All of them are equal for the parts that matter day to day: every one gets an address, a terminal, logs, monitoring, an activity trail, and a place in the Project.

## Where to go next

- [Deploying with a Dockerfile](/docs/build/deploying-with-a-dockerfile) for the step by step of a single container.
- [Deploying a Compose stack](/docs/build/deploying-a-compose-stack) for the step by step of a whole stack.
- [Services](/docs/build/services) for what you can do with a Service once it is running.
- [Redeploying and rollback](/docs/build/redeploying-and-rollback) for what a redeploy applies.
- [Troubleshooting](/docs/reference/troubleshooting) for deploys that did not work.
