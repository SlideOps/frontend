# Quick start

From a fresh account to a running, verified application on your own server. These are the real steps, in the order the app asks for them. Allow half an hour the first time, most of which is reading plans rather than waiting.

## Before you begin

You need one thing SlideOps cannot give you: **a Linux machine you can already reach over SSH**.

A VPS, a bare metal box, a home lab machine, anything. It should be one of the families SlideOps knows: Debian or Ubuntu, Fedora, RHEL, Rocky or AlmaLinux, Arch, Alpine, or openSUSE. You need its address, an SSH port, an account you can sign in with, and either that account's private key or its password.

Root works for the initial connection. SlideOps will move off it in step 4.

## 1. Create your account

Sign up as an Operator with an email and a password. If the deployment has GitHub sign in configured, that works too.

Your Personal Workspace is created with you. Servers, Projects, Operations, and History inside it belong to you and nobody else.

Turn on two step verification from **Account → Security** before you go further. It costs a minute now and protects an account that will shortly hold SSH credentials for real machines.

## 2. Connect a server

Go to **Infrastructure → Servers** and choose **Connect a Node**.

You are asked for:

| Field | What it is |
| --- | --- |
| Name | What you will call it in SlideOps, for example `web-1` |
| Hostname | Optional label, for example `contabo-vps` |
| Address | The IP address or hostname to connect to |
| SSH port | Defaults to `22` |
| SSH username | The account to sign in as, for example `root` or `deploy` |
| Credential | A private key, or a password |

**Prefer a key.** It is the stronger credential, and it is what lets SlideOps harden SSH later without any risk of locking you out.

Your credential is encrypted the moment it reaches the backend, decrypted only at connection time, and never written to a log or returned by the API. The host key is trusted on first use and pinned after that.

Connecting registers the machine. It does not change anything on it. There is no agent to install and nothing to run on the server first.

## 3. Run the quick check

On the server's page, run the quick check.

This is Discovery and Assessment: SlideOps opens a read-only connection and reads the operating system and its family, the package manager, the init system, what is installed, what is listening, and the SSH posture. **It never modifies a single setting.**

What comes back is a picture in plain language: what is in place, what is missing, and how much each gap matters. Everything that follows is planned from this, and it is planned from what SlideOps actually observed rather than from a record of what SlideOps has done. A machine you hardened yourself last year gets credit for it.

## 4. Secure the server

The server page has a **Secure this server** panel that walks you through this in dependency order, so a step is never offered before the thing it needs. Each step is an ordinary Operation: you read the plan, you approve it, it executes, it verifies.

The shape of it is:

1. **Create a non-root administrator.** A dedicated account with full sudo, so SlideOps never has to sign in as root. You can supply a public key, or have one generated for you from the server's Settings tab.
2. **Harden SSH.** Root can no longer sign in directly over SSH, and password authentication is turned off, so the only way in is the account you just created.
3. **Switch the connection.** SlideOps repoints its stored credential at the non-root account. It signs in with the new account first and only commits the switch if that succeeds.

The panel may show other measures depending on what the quick check found. Complete them in the order it offers them.

Two things to notice while you do this:

- Every one of these Operations ends with the check **a fresh connection still authenticates**. A change that would have cut off your access is caught while there is still a working connection to undo it with. This is why hardening SSH through SlideOps is safe to do on a machine that matters.
- From this point on, every action runs as the non-root sudo account. Never as root.

## 5. Create a Project

Go to **Build → Projects** and create one. Give it a name, for example `storefront`.

A Project holds a stack and the Services that run it. If you want separate dev and production, make two Projects: SlideOps has no built in environments, so this is your decision to make.

## 6. Assign the server to the Project

Open the Project, go to its **Overview** tab, and assign the server you just secured.

Assigning changes nothing on the machine. It is a filing decision, recorded so the right options appear in the right place: the Project's Capabilities become startable on that server, and its Services have somewhere to run.

A server belongs to one Project at a time. Unassigning it later stops nothing.

## 7. Install the Project's stack

Open the Project's **Stack** tab.

Some Capabilities are already there with nothing to install: the ones about the machine itself, and the common data engines. What is not there yet is everything else. If your application runs in a container, install **Containers** here. If you deploy from a repository, install **Git deploy**. If it needs a language runtime on the host, install that.

Install only what this Project needs. Because Plugins install into a Project rather than into your whole account, a Go Project never has to carry a Python runtime.

Each installed Plugin unlocks its Capabilities inside that Project, and they show up on the **Capabilities** tab.

## 8. Connect GitHub, if you deploy from a repository

On the Project's Overview tab there is a GitHub section. Connect once, through the platform's OAuth app; the token is stored encrypted.

You can grant access to all repositories your account can reach, or pick specific ones. The deploy form only ever offers what is configured here, so if a repository you expect is missing, this is where to add it.

Private repositories need this. A public repository can be cloned by URL without it.

## 9. Deploy a Service

Go to **Build → Services** and choose **Deploy a Service**. You are asked to pick the shape of what you are deploying:

- **Software.** An application, API, frontend, or worker, from a repository or an image.
- **Capabilities.** Infrastructure your Project depends on, such as PostgreSQL and Redis, deployed together as one Service.

If your application needs a database, deploy the Capabilities Service first, so the connection details exist before the application looks for them.

For a Software Service you fill in:

- **Name.** Lowercase letters, numbers, and hyphens, under 64 characters.
- **Project** and **Node**.
- **Runtime.** Container, systemd, or Compose stack. Container is the recommended default.
- **Source.** An image, or a repository and branch.
- **Command.** Optional for a container, required for a systemd Service.
- **Resource limits.** The recommended configuration is 0.5 vCPU and 256 MB of memory, which suits most applications. These are your own resources on your own server, so change them if you know you need more.
- **Port.** The port your application listens on inside its container, one per line. SlideOps picks the public port so two applications on one server can never take each other's. Write `8080:80` if you want to pin the public one yourself.
- **Environment.** One `KEY=value` per line. Prefix a line with `secret:` to seal that value. See [Environment and secrets](/docs/build/environment-and-secrets).

### Run the preflight check first

Before you press Deploy, use **Run preflight**. It connects to the server read-only and reports what a real deploy would run into: an unreachable server, a missing runtime tool, a port already taken, resources tighter than you asked for. Where a problem has a fix, it offers it there.

Preflight changes nothing, and it does not block the deploy. It just means you find out now rather than three minutes into a build.

Then press **Deploy Service**. The Service is created immediately at `deploying` and the work runs in the background.

## 10. Watch it come up

The Service page updates on its own. What happens behind it, in order:

1. The hostname and ports are decided before anything is built.
2. Sealed environment values are revealed to the deploy, in memory.
3. For a repository source, the repository is cloned shallow on the first deploy and the image is built. For an image source, the image is pulled.
4. The workload is started, with `--restart unless-stopped` for a container or `Restart=always` for a systemd unit.
5. SlideOps waits a moment and checks it is genuinely up rather than crash-looping. A container that started and exited fails the deploy with its own last output as the reason.
6. The service port is opened on the firewall so it is reachable.
7. The deployed commit is recorded.
8. An address is put in front of it.

If it fails, the reason is kept on the Service page rather than only in a stream you were not watching.

## 11. Reach it

A deployed Service gets an address on the day it deploys, without you configuring DNS. It is shown on the Service's Overview tab and on the Services list.

You get the hostname first if the Service has one, and then a direct `http://<server-address>:<port>` for each published port. The hostname survives a redeploy that moves the port, and it is the name any certificate is issued for.

Where the Service serves a page, you can preview it from inside SlideOps over the connection you already have.

## 12. Look around

The Service page is now where the work happens:

- **Overview**: its address, a preview, live CPU and memory, its summary, and the lifecycle actions.
- **Logs**: live output, the Diagnose panel, and the Service's own activity trail.
- **Shell**: a real interactive session inside the container, over the SSH connection SlideOps already holds.
- **Settings**: the deployment configuration, its environment, and the connection details for anything it depends on.
- **CI/CD**: automatic deployment on push, or a deploy hook for an outside pipeline.

And the server page is where the machine lives: its security posture, what else is running on it, its own terminal, and the Capabilities available to it.

## What you have now

```
Workspace
  └── Project "storefront"
        ├── Node "web-1"          secured, non-root, hardened SSH
        └── Service "api"         running, verified, addressable
```

Every change you made is in History, with its plan, its output, and its verification evidence.

## Where to go next

- [Projects](/docs/build/projects) for how Projects, servers, and Services fit together.
- [Deploying](/docs/build/deploying) for the sources and runtimes in full.
- [Environment and secrets](/docs/build/environment-and-secrets) before you put a real credential anywhere.
- [Troubleshooting](/docs/reference/troubleshooting) if any of the above did not go the way it should have.
