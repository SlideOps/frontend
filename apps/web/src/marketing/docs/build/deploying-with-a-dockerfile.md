# Deploying with a Dockerfile

This page takes you from a repository with a `Dockerfile` in it to one container running on your own server, step by step. Every field is named as it appears on the deploy form, and every step says what you should see before you move on.

If you have not deployed anything with SlideOps before, read [Core concepts](/docs/start/core-concepts) first. It is five minutes and it names the things this page assumes.

## Is this the right page?

One question decides it, and it is worth answering before you fill in anything.

**Open your application's configuration and look at the addresses it points at.**

- If it talks to things by a real address, or by connection details a Capability handed it, this is the right page.
- If it points at a bare name such as `postgres`, `redis`, `nats` or `clamav`, this is the wrong page. Go to [Deploying a Compose stack](/docs/build/deploying-a-compose-stack).

Here is why. A single container joins Docker's default bridge and nothing else is put on it. Names like `postgres` and `redis` are what the **other services in a compose file** are called, and they resolve only on the network Compose builds for a stack. On the default bridge there is nobody there called `postgres`, so the connection fails at startup and the container exits.

So: one process, talking to real addresses, belongs here. An application that expects a database container beside it belongs on the Compose page.

## Before you start

Five things need to be true. Each links to the page that gets you there.

| You need | Where |
| --- | --- |
| A server connected and secured | [Servers](/docs/infrastructure/servers) |
| A Project, with that server assigned to it | [Projects](/docs/build/projects) |
| Containers installed on that server | [Capabilities](/docs/infrastructure/capabilities), the Enable Containers Capability |
| A repository with a `Dockerfile` that builds your application | Your own repository |
| GitHub connected, if the repository is private | The Project's Overview tab |

You also need one fact from your own application: **the port it listens on inside the container**. Not the port you want to reach it on. The port the process binds.

If Docker is not on the server, the deploy is refused before it starts anything, with a message telling you to apply the Enable Containers Capability first. That is not a failure to debug; it is a missing step.

## Create the Service

### 1. Open the deploy form

Go to **Build → Services** and press **Deploy a Service**.

You should see two cards: **Software** and **Capabilities**.

### 2. Choose Software

Press **Continue** on the **Software** card.

The deploy form opens. If instead you see "A Project and a Node come first", you are missing one of them; go back to [Projects](/docs/build/projects) and finish that first.

### 3. Give it a **Name**

Lowercase letters, numbers and hyphens, starting with a letter or a number, under 64 characters. For example `api`.

This is the name you will see everywhere afterwards, and it is what a permanent delete asks you to type back. Choose something you will recognise in a list in six months.

### 4. Choose the **Project** and the **Node**

Two dropdowns, side by side. **Project** is the stack this belongs to. **Node** is the server it will actually run on.

Both start empty and both are required. If the server you want is not offered, it has not been assigned to that Project yet.

### 5. Leave **Runtime** on **Container**

Three options: **Container**, **systemd**, and **Compose stack**. **Container** is selected for you and it is the one this page is about.

Worth knowing once: a container Service is removed and recreated on every single deploy. SlideOps runs `docker rm -f` on the old one and then `docker run` for the new one. That is why a configuration change always takes effect here, with nothing to remember and nothing to toggle.

### 6. Choose the **Source**

Two options: **Image** and **Repository**.

- **Repository** clones your repository and builds the `Dockerfile` in it. Choose this one if you are following this page.
- **Image** runs an image that already exists in a registry. Nothing is built. Choose this if your build happens somewhere else.

The rest of these steps assume **Repository**. For **Image**, you get a single **Image** box instead of steps 7 and 8, and everything after that is the same.

### 7. Fill in **Repository URL** and **Branch**

If GitHub is connected, use the repository search above the box instead of typing: picking a repository fills the clone URL and sets **Branch** to that repository's default branch.

**Branch** defaults to `main`. Change it if you deploy something else.

Every later redeploy fetches this branch and resets to its head, so the branch you name here is the branch this Service tracks from now on.

### 8. Set **Subdirectory (optional)**, only for a monorepo

Leave this empty if the `Dockerfile` is at the root of the repository. Most of the time it is.

If your application is one module inside a larger repository, put its path here, for example `apps/api`. It is a path, not a command. The repository is still cloned in full; this narrows the build to one directory.

Get this wrong and the deploy fails with a message naming exactly where it looked:

> no Dockerfile found in "apps/api": this Service's build subdirectory is set to "apps/api", but the repository has none there

### 9. Leave **Command (optional)** empty

Your `Dockerfile` already has an entrypoint. Fill this in only when you want to override it, for example to run the same image as a worker instead of a web process.

### 10. Leave the resource limits alone, unless you know otherwise

The panel says **Recommended configuration**: 0.5 vCPU, 256 MB memory, and a safe process default. That suits most applications and most Operators never change it.

Press **Advanced** if you need to, and you get three boxes: **vCPU limit**, **Memory (MB)** and **Process limit**. These are ceilings on your own server, not a plan gate.

These are also the one part of the configuration you can change later without a redeploy. Everything else on this form needs one.

### 11. Fill in **Port your app listens on**

One port per line. Write the port **inside** the container, for example `80`. The box starts with `80` already in it.

SlideOps picks the public port for you, from a range it manages, so two applications on one server can never take each other's port. If you want to choose the public one yourself, write it as `host:container`:

```text
8080:80
```

A port you pin is honoured exactly, even if something else already holds it. The deploy will then report the conflict from the server rather than quietly moving your application.

If your application listens on nothing at all, such as a queue worker, leave this empty. You will not be given a web address, which is correct rather than broken.

### 12. Fill in **Environment (optional)**

One variable per line, written `KEY=value`:

```text
LOG_LEVEL=info
PORT=80
DATABASE_URL=postgres://app@db.internal.example:5432/storefront
```

Prefix a line with `secret:` to seal that value:

```text
secret:DATABASE_PASSWORD=<the password>
```

A sealed value is encrypted, revealed only to the deploy itself, and it reads back as `[stored securely]` afterwards. **You cannot get it back**, and neither can anyone else, so keep anything you might need again somewhere you can read it.

A few rules that save an evening:

- A whole line starting with `#` is a comment. A `#` inside a value stays part of the value.
- `export KEY=value` is accepted, so a file meant for a shell pastes in as it is.
- A quoted value keeps its contents and loses the quotes. Single quotes are literal; double quotes apply escapes, so `\n` becomes a real newline. **Use single quotes for JSON**, because JSON is full of double quotes.
- A quoted value may run over several lines, which is how a PEM key or a formatted JSON blob pastes in.

[Environment and secrets](/docs/build/environment-and-secrets) has the whole of this, including how to edit one variable later without touching the others.

### 13. Press **Run preflight**

It is in the **Preflight check** panel at the bottom of the form, above the Deploy button.

It connects to the chosen server read-only and reports what a real deploy would run into: an unreachable server, a missing runtime tool, a port already taken, resources tighter than you asked for. It changes nothing and it does not block the deploy.

You should see a list of checks, ideally all passing. Where a check has a fix, applying it from there is a normal Operation with a plan you approve.

Use it. Finding a closed firewall port now is cheaper than finding it three minutes into a build.

### 14. Press **Deploy Service**

The Service is created immediately at `deploying` and you land on its page. The work runs in the background, so you can watch it or walk away.

## Watch it come up

The Service page updates on its own until it settles at `running` or `failed`. Behind it, in order:

1. The hostname and the published ports are settled, before anything is built.
2. Sealed environment values are revealed to this deploy, in memory only.
3. The repository is cloned on the first deploy, or fetched and reset to the branch head afterwards.
4. The image is built from your `Dockerfile`.
5. The container is started.
6. SlideOps waits a few seconds and looks again, so a container that started and immediately exited fails the deploy instead of being reported as a success.
7. The port is opened on the firewall.
8. The deployed commit is recorded.
9. An address is put in front of it.

Step 9 is best effort and runs after the Service is marked running. If routing does not work out, the Service is still up and still reachable at its port, and the failure is recorded on the Service rather than pretending the deploy failed.

What you actually run, once it is up, is a container created like this:

```sh
docker run -d --name <service-name> \
  --restart unless-stopped \
  --cpus=0.5 --memory=256m --pids-limit=<n> \
  -e 'LOG_LEVEL=info' \
  -p <public-port>:80 \
  <the image that was just built>
```

`--restart unless-stopped` is why the workload comes back after a reboot but stays down if you stopped it deliberately.

## What to check when it is running

Four things, in this order. They take a minute together.

1. **Status is `running`**, on the Service's Overview tab. Not `deploying`, not `failed`.
2. **The address answers.** The Overview tab lists the hostname first, then a direct address for each published port. Open one. Where the Service serves a page, there is a preview on the same tab, reached over the SSH connection SlideOps already holds.
3. **The logs say what you expect.** The **Logs** tab is live output. You are looking for your application's own startup line, not for silence.
4. **Live CPU and memory look sane.** Also on Overview. A process sitting at its memory ceiling is about to be killed.

If the address does not answer but the status is `running`, the application is up and only the name in front of it is not. Check that a reverse proxy Capability is in place on the machine and that ports 80 and 443 are open. **Diagnose** checks exactly this.

## When it crash loops

A crash loop means the container started, failed, restarted, and failed again. SlideOps catches this rather than calling the deploy a success, and says so:

> The container started, then crashed and is stuck restarting.

This is your application failing, not SlideOps failing. Work through it in this order.

1. **Read the failure reason on the Service page.** The container's own last output is included, because it is the line you would have opened a terminal to read. Where the container printed nothing at all, the message says that too.
2. **Open the Logs tab** for the fuller output.
3. **Press Run checks in the Diagnose panel**, above the logs. Diagnose checks a deployed Service without changing the server: whether the container is up or crash-looping, whether the dependencies it needs are still reachable, and whether anything answers on its hostname.
4. **Read the activity trail**, beside the logs. It lists configuration changes by variable name, which is usually the answer: three variables changed nine minutes before it became unhappy.

The common causes are short and predictable: a missing environment variable, an entrypoint that is not executable, a port already bound inside the container, or a dependency it could not reach at startup.

**One cause deserves its own paragraph.** If two or more bare hostnames fail to resolve, Diagnose now says plainly that this looks like a stack deployed as one container. It is right. Read [Deploying a Compose stack](/docs/build/deploying-a-compose-stack) and redeploy it as one.

## Changing something and deploying again

Saving a change records it. **A redeploy applies it.**

A container bakes its environment, its command and its ports in at the moment it is created, so editing them cannot reach into a running process and change what it sees. After any save, the Service page says so:

> **Saved, but not yet running.** The container is still the one built from the previous configuration until you redeploy.

with **Redeploy to apply** beside it. The prompt clears when a deploy actually completes.

So the loop is:

1. Change what you need on the Service's **Settings** tab, or push a commit to the branch this Service tracks.
2. Press **Redeploy**, on the Overview tab or from the prompt.
3. Watch it settle back to `running`.

Two things to know about that button.

**Redeploy always takes the newest commit.** It fetches the branch and resets to its head. A redeploy to apply a one-line environment edit also ships whatever else has landed on that branch since. If that is not what you want, deploy from a branch you control.

**There is no rollback to a previous release.** Getting back to older code means putting that code back on the branch. See [Redeploying and rollback](/docs/build/redeploying-and-rollback).

**Restart is not Redeploy.** Restart bounces the container you already have, with the image and the environment it was created with. It cannot pick up an edit, because nothing was rebuilt.

## Troubleshooting

### "docker is not installed on this node"

> docker is not installed on this node; apply the Enable Containers Capability first

Install it as a Capability rather than by hand, so the server's facts and the Project's stack both know about it. Preflight catches this before you deploy.

### "no Dockerfile found"

Two variants, and the wording tells you which mistake you made. One says your **Subdirectory** points at a directory with no `Dockerfile` in it; correct it in the **Build path** box on the Service's **Settings** tab, which is the same setting under its later name. The other says there is none at the repository root and suggests setting a subdirectory; you have a monorepo and did not set one.

### "The container started and then exited."

The deploy got as far as starting your container and it stopped on its own. The container's last output is the reason given. Start there rather than with SlideOps.

### The application cannot resolve `postgres` or `redis`

You deployed something that expects other containers beside it as a single container. SlideOps warns about this during the deploy where the repository contains a compose file:

> This repository includes docker-compose.yml, so it expects other containers alongside it, but this Service is a single container: a hostname like "postgres" or "redis" will not resolve.

Two real fixes. Deploy it as a [Compose stack](/docs/build/deploying-a-compose-stack) so Compose builds the network. Or install what it needs as [Capabilities](/docs/infrastructure/capabilities) and point its environment at the connection details those give you.

### "no free host port is available on this node"

SlideOps allocates public ports from a dedicated range and that range is full. Remove Services you no longer run, or pin the public port yourself with `host:container`.

### The change I saved is not taking effect

You saved and did not redeploy, or you pressed Restart instead. Only resource limits apply in place. See [Changing something and deploying again](#changing-something-and-deploying-again) above.

### The deploy worked but the hostname does not answer

Routing runs after the Service is marked running, so a routing problem never fails a deploy that otherwise worked. The Service is up at its port; only the name is not answering. Diagnose checks this and offers the fix.

## Where to go next

- [Deploying a Compose stack](/docs/build/deploying-a-compose-stack) if this turned out to be the other case.
- [Services](/docs/build/services) for everything the Service page can do once it is running.
- [Environment and secrets](/docs/build/environment-and-secrets) before you put a real credential anywhere.
- [Deploying](/docs/build/deploying) for sources, runtimes, adoption and automatic deployment in full.
