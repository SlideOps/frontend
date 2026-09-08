# Deploying a Compose stack

This page takes you from a repository with a compose file in it to a whole stack running on your own server: your application, its database, its cache, whatever the file declares. Step by step, with every field named as it appears on the deploy form.

If the words Project, Service and Capability are new, read [Core concepts](/docs/start/core-concepts) first.

## Is this the right page?

Almost always, one thing decides it.

**Open your application's configuration and look at the addresses it points at.** If it points at a bare name such as `postgres`, `redis`, `nats` or `clamav`, this is the right page.

Those names are not hostnames anybody registered. They are what the **other services in a compose file** are called, and they resolve only on the network Compose builds when it brings a stack up. Compose creates that network; nothing else does.

A single container is the other case. It joins Docker's default bridge, and nothing else is put on it, so there is nobody there called `postgres`. An application deployed that way fails at startup on the first connection it tries, every time, and no amount of environment fixing changes it.

So:

| Your application | Deploy it as |
| --- | --- |
| Points at bare service names from a compose file | A Compose stack, this page |
| One process talking to real addresses, or to connection details a Capability gave it | [A single container](/docs/build/deploying-with-a-dockerfile) |

The third option is to stop needing the stack: install PostgreSQL and Redis as managed [Capabilities](/docs/infrastructure/capabilities) and point your application's environment at the connection details they give you. That is a real answer, and it is what the panel described in [Plan this as Capabilities](#the-panel-that-appears-plan-this-as-capabilities) below offers to do for you.

## Before you start

| You need | Where |
| --- | --- |
| A server connected and secured | [Servers](/docs/infrastructure/servers) |
| A Project, with that server assigned to it | [Projects](/docs/build/projects) |
| Containers on that server | [Capabilities](/docs/infrastructure/capabilities), the Enable Containers Capability |
| Docker Compose on that server | [Capabilities](/docs/infrastructure/capabilities), the Install Docker Compose Capability |
| A repository containing a compose file, on the branch you intend to deploy | Your own repository |
| GitHub connected, if the repository is private | The Project's Overview tab |

**A Compose Service must come from a repository.** A stack is described by a file, and an image on its own cannot describe one, so the deploy is refused if you pick an image source with the Compose runtime.

Both missing tools are refused before anything runs, with a message naming which Capability to apply. Preflight finds them earlier still.

## What your compose file needs to look like

SlideOps does not require a special file. It requires a working one, in the repository, on the branch you deploy. Four things are worth checking before you start.

1. **Your own code has a `build:` section.** SlideOps brings the stack up with `--build`, so anything with a `build:` is built from the repository on every deploy. A service with only an `image:` is pulled.
2. **The backing services are named the way your application spells them.** The service key in the file is the hostname. `postgres:` in the file is what makes `postgres` resolve.
3. **Ports are published by the file.** For a stack, the `ports:` lines in your compose file are what actually open on the machine.
4. **Anything you want to keep is on a named volume.** Data written inside a container and not on a volume is lost the moment that container is replaced, and there are two ways it gets replaced.

A file that satisfies all four looks roughly like this:

```yaml
services:
  api:
    build: .
    environment:
      DATABASE_URL: postgres://app:${DATABASE_PASSWORD}@postgres:5432/app
      REDIS_URL: redis://redis:6379
    ports:
      - '8080:80'
    depends_on:
      - postgres
      - redis

  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: app
      POSTGRES_DB: app
      POSTGRES_PASSWORD: ${DATABASE_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7

volumes:
  pgdata:
```

Note the two `postgres` spellings doing different jobs: `postgres:` at the bottom names the service, and `@postgres:5432` in the URL resolves to it. That is the whole mechanism, and it is why this file cannot run as one container.

`${DATABASE_PASSWORD}` is the other thing to notice. The next section is about where that value comes from.

## How your environment reaches the stack

You do not put configuration into the compose file. You put it in the Service's **Environment**, and SlideOps writes it to a `.env` file in the project directory on the server. That is the file `docker compose` reads, so `${DATABASE_PASSWORD}` in the compose file is filled from it.

So the chain is: you type `DATABASE_PASSWORD=...` in SlideOps, SlideOps writes it into `.env`, compose substitutes it into the file, and the container gets it.

Two consequences.

- **A variable your compose file never references does nothing.** Unlike a single container, where every variable is passed straight to the process, a stack only receives what its own file asks for. Reference it with `${NAME}` or the variable is written to `.env` and ignored.
- **Sealing still works exactly as it does everywhere else.** Prefix a line with `secret:` and the value is encrypted, revealed only to the deploy itself, and unreadable afterwards by anyone, including you.

[Environment and secrets](/docs/build/environment-and-secrets) has the full rules. The short version you need here:

```text
# a comment line, ignored
LOG_LEVEL=info
secret:DATABASE_PASSWORD=<the password>
CONFIG_JSON='{"retries": 3, "timeout": "5s"}'
```

- A whole line starting with `#` is a comment; a `#` inside a value stays part of the value.
- `export KEY=value` is accepted.
- A quoted value keeps its contents and loses the quotes. Single quotes are literal; double quotes apply escapes, so `\n` becomes a real newline. **Use single quotes for JSON**, because JSON is full of double quotes. A quoted value may run over several lines.

## Create the Service

### 1. Open the deploy form

Go to **Build → Services** and press **Deploy a Service**. Press **Continue** on the **Software** card.

### 2. Give it a **Name**

Lowercase letters, numbers and hyphens, under 64 characters. This names the whole stack, not one container in it, so name it after the thing it is: `storefront`, not `storefront-api`.

### 3. Choose the **Project** and the **Node**

Two dropdowns. **Project** is the stack this belongs to; **Node** is the server it runs on. Both are required.

### 4. Choose **Compose stack** under **Runtime**

The third of the three runtime cards. Its own description tells you the same thing this page opened with: compose makes the network, so the service names in the file resolve.

Choosing it changes what the rest of the form will accept. Read step 5 before you fill anything else in.

### 5. Choose **Repository** under **Source**

**Image** is selected by default and it will not work here. Switch to **Repository**.

If you leave it on **Image**, the deploy is refused:

> a compose service must come from a repository

### 6. Fill in **Repository URL** and **Branch**

If GitHub is connected, pick the repository from the search above the box and both are filled for you.

**Branch** matters more than usual here. The compose file has to be on the branch you name. A stack that deploys fine from `main` and fails from a release branch is usually a compose file that only exists on one of them.

### 7. Set **Subdirectory (optional)** if the stack is not at the repository root

Leave it empty for the common case.

### 8. Leave **Command (optional)** empty

Your compose file already says what each service runs.

### 9. Set the resource limits

The **Recommended configuration** is 0.5 vCPU and 256 MB with a safe process default. Press **Advanced** for **vCPU limit**, **Memory (MB)** and **Process limit** if you need more.

Resource limits are the one thing you can change later without a redeploy.

### 10. Fill in **Port your app listens on**

For a stack, this box does not create the mapping. Your compose file's `ports:` lines are what open on the machine.

Put the published host port of the service you actually want to reach, so the address SlideOps shows you points somewhere real. For the example file above, that is `8080`. Check the address on the Overview tab once the deploy finishes.

### 11. Fill in **Environment (optional)**

One `KEY=value` per line, `secret:` to seal. Everything from [How your environment reaches the stack](#how-your-environment-reaches-the-stack) applies here.

For the example file, that is one line:

```text
secret:DATABASE_PASSWORD=<a password you choose>
```

### 12. Press **Run preflight**

In the **Preflight check** panel at the bottom. It connects read-only and reports what a real deploy would run into: an unreachable server, a missing runtime tool, a port already taken. It changes nothing and it does not block the deploy.

This is where a missing Docker Compose shows up before it costs you a build.

### 13. Press **Deploy Service**

Not the button in the plan card above it. See the next section for what that card is.

The Service is created immediately at `deploying` and you land on its page.

## The panel that appears: Plan this as Capabilities

The moment you choose **Repository** and **Compose stack**, a card appears on the form headed **Plan this as Capabilities**. It is worth one paragraph, because it looks like part of the form and it is not.

It offers a different deployment entirely. Instead of running your compose file as a stack, SlideOps reads it and installs the databases and caches it names as managed Capabilities, creates the database and account your application needs, and wires the credentials into its environment. **Show me the plan** reads the repository and shows you what would happen; nothing runs until you press **Approve and run this plan**.

To deploy the stack as your file describes it, ignore this card and press **Deploy Service** at the bottom of the form. To take the other route, read [Deploying](/docs/build/deploying) first, because it changes how your application is configured: it will be handed connection details rather than finding a container called `postgres`.

## Watch it come up

The Service page updates on its own until it settles at `running` or `failed`.

What SlideOps runs on the server is one command:

```sh
docker compose --project-directory <checkout-dir> -p <project> up -d --build --remove-orphans
```

`--build` is why a service with a `build:` section picks up your newest code. `--remove-orphans` is why a service you deleted from the compose file does not linger as a container nobody owns.

## Reading which service in the stack failed

A stack fails differently from a single container. The deploy does not fail; one service in it does, and the rest carry on running around the hole.

Work through it in this order.

1. **Read the failure reason on the Service page.** A failed deploy keeps its reason there, so you do not have to have been watching the stream.
2. **Open the Logs tab.** For a stack this is the stack's output, so you are looking for which service is printing the errors.
3. **Press Run checks in the Diagnose panel**, above the logs. Diagnose checks a deployed Service without changing the server: whether a container is crash-looping, whether the dependencies it needs are reachable, and whether anything answers on the hostname. It reports a crash loop with the container's own last output, which is the line you would have opened a terminal to read.
4. **Open the Shell tab** if you want to look yourself. For a Compose Service the shell is **on the server**, in the stack's checkout directory, not inside any one container, because a stack is several containers and there is no single inside to enter. Your usual compose commands work there:

```sh
docker compose ps
docker compose logs --tail 100 api
```

One command to avoid: `docker compose config` prints every resolved value, sealed secrets included, straight to your screen. There is nothing there you need that the Service page will not show you safely.

Opening a shell is recorded in the Service's activity trail, as every shell is.

## Redeploying, and the force recreate toggle

### The ordinary case

1. Change what you need on the Service's **Settings** tab, or push a commit to the branch this Service tracks.
2. Press **Redeploy**.
3. Watch it settle back to `running`.

**Saving does not change what is running.** After a save the Service page says so, with **Redeploy to apply** beside it:

> **Saved, but not yet running.** The container is still the one built from the previous configuration until you redeploy.

**A redeploy always takes the newest commit.** It fetches the branch and resets to its head, so an environment edit ships alongside whatever else has landed. There is no rollback to a previous release: getting older code back means putting it back on the branch. See [Redeploying and rollback](/docs/build/redeploying-and-rollback).

### When a redeploy succeeds and nothing changes

This is the failure that sends people looking for a bug that is not there.

`docker compose up` reuses a container it judges unchanged, and a change to a value it reads from an env file does not reliably change that judgement. So you correct a variable, redeploy, watch the deploy report success, and get the identical error back. The stack came back up on the containers it already had, still carrying the old values.

The fix is a checkbox in the Service's **Actions**:

> **Recreate containers on the next deploy**

It is off by default. Ticking it changes nothing immediately; it decides what the next deploy does, which is to add `--force-recreate` and replace the containers instead of reusing them.

**It has a price, which is why it is not on by default.** Replacing costs a moment of downtime, and anything written inside a container that is not on a volume is lost. That is the same cost as the volume rule in [What your compose file needs to look like](#what-your-compose-file-needs-to-look-like), arriving from the other direction.

Reach for it when you have edited a value, redeployed, and the stack is still behaving as though the old value is in place. Leave it off the rest of the time.

On a single container Service the same place in Actions says there is nothing to turn on. That is correct: a single container is removed and recreated on every deploy already, so the setting would decide nothing.

## Troubleshooting

### "docker compose is not installed on this node"

> docker compose is not installed on this node; apply the Install Docker Compose Capability first

Apply the Capability rather than installing it by hand, so the server's facts and the Project's stack both know about it.

### "no docker compose file was found in this repository"

The Compose runtime was chosen, the repository was cloned, and there is no compose file in it. Either the file lives on a branch you are not deploying, or this Service should be a plain container.

### "a compose service must come from a repository"

You left **Source** on **Image**. A stack is described by a file, and an image cannot describe one. Switch the source to **Repository**, or switch the runtime to **Container**.

### The application cannot resolve `postgres` or `redis`, and it is a Compose Service

Check the spelling of the service key in your compose file against the hostname in your configuration. Compose creates the network and puts every service on it under its own key, so a name that does not resolve is a name that is not a key in the file.

If two or more bare hostnames fail to resolve on a **single container** Service, Diagnose says plainly that this looks like a stack deployed as one container. It is right, and this page is the fix.

### A redeploy reports success and the old behaviour continues

The containers were reused. Tick **Recreate containers on the next deploy** in the Service's Actions and redeploy. See [When a redeploy succeeds and nothing changes](#when-a-redeploy-succeeds-and-nothing-changes).

### A variable I added is not reaching the application

For a stack, a variable only arrives if your compose file references it. Add `${THE_NAME}` where the service needs it, commit, and redeploy.

### Data disappeared after a deploy

Something was written inside a container that is not on a named volume, and the container was replaced. Add a volume for it in the compose file.

Note that removing a Compose Service brings the stack down and removes orphans but **leaves its volumes** alone, because they hold data SlideOps did not create.

## Where to go next

- [Deploying with a Dockerfile](/docs/build/deploying-with-a-dockerfile) if this turned out to be the other case.
- [Services](/docs/build/services) for everything the Service page can do once the stack is running.
- [Environment and secrets](/docs/build/environment-and-secrets) before you put a real credential anywhere.
- [Capabilities](/docs/infrastructure/capabilities) for running the database as managed infrastructure instead.
