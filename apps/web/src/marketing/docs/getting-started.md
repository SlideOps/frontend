## Getting started

SlideOps helps you run your own Linux infrastructure with confidence. It works in two levels. First you connect and secure your servers. Then you create Projects, assign your secured servers, install only the stack each Project needs, and deploy Services onto them. Every change is planned, approved by you, executed in the open, and verified.

This guide takes you from a fresh account through a secured server to a running, monitored Service.

### 1. Create your account

Sign up as an Operator with an email and a password. Your Workspace is yours alone: the servers, Projects, and Operations inside it belong to you and no one else. We recommend turning on two step verification from the Security screen once you are in. The Workspace leads with two areas, Servers and Projects, in that order.

### 2. Connect a server

A server is one Linux machine you reach over SSH. To connect one, you give SlideOps its address, an SSH username, and how to sign in: a private key or a password. To bootstrap the connection you can start as root or an existing account, but SlideOps does not stay there. A key is the stronger choice, and it lets SlideOps harden SSH later without locking you out.

Your credential is encrypted the moment it reaches the backend, is only ever decrypted at connection time, and is never written to logs or returned by the API.

### 3. Run the quick check

The quick check opens a read-only connection and reads the state of the server: its operating system, the services it runs, the ports it listens on, and its SSH posture. It never changes a single setting. Everything that follows is planned from what the check finds, and it produces an Assessment: the same picture in plain language, with findings and recommendations, so you know what is worth doing next.

### 4. Secure the server

SlideOps never operates a server as root once it is connected. Securing a server walks you through this in order, and each step is a normal Operation you review and approve.

- **Create a non-root administrator.** A dedicated account with full sudo, so SlideOps never has to sign in as root.
- **Harden SSH.** Root can no longer sign in directly over SSH, so the only way in is the account you just created.
- **Switch the connection.** SlideOps points its stored credential at the non-root account. It signs in with the new account first and only switches if that succeeds, so you are never locked out.

From that point every action runs as the non-root sudo account, never as root. These four security outcomes (Secure SSH, the host Firewall, Create Application User, and Manage Packages and updates) are Core: they are on every server with nothing to install. Later, a server settings page lets you rotate the connection credential and manage the accounts on the server.

### 5. Connect GitHub, optionally

If you deploy from a repository, connect GitHub once. SlideOps runs the authorize and callback through your own OAuth app and stores the token encrypted. A Service with a repository source then clones on the first deploy and pulls the branch you name on every redeploy.

### 6. Create a Project and assign a server

A Project holds one stack and the Services that run it. Create a Project, then assign one or more of your secured servers to it. A Project runs its Services on the servers assigned to it, and several Projects can share one large server under hard resource limits without fighting for resources.

### 7. Install the Project's stack

Only security is Core. Everything else (containers, a reverse proxy, HTTPS, monitoring, backups, databases, runtimes, static sites, and extra security add-ons) is a marketplace Plugin, installed per Project. Open the Project and install only the Plugins it needs, so the Project carries only the stack it uses. Each installed Plugin unlocks its Capabilities inside that Project.

### 8. Deploy a Service

A Service is one deployed workload on one of the Project's servers, running under hard limits on CPU, memory, and disk that your tier sets. If the Service comes from a repository, name the branch to deploy: the first deploy clones it and every redeploy pulls that branch. Starting a deploy does not change anything yet. First you see the plan: every step in order, the risks stated plainly, how the change would be rolled back, and how the result will be verified. Nothing runs until you approve, and then execution streams live in a terminal with a step timeline.

### 9. Verify and monitor

Every Operation ends by proving its result. SlideOps re-reads the server and, where it matters, opens a fresh connection so a change that would cut you off is caught. Each check shows whether it passed and the evidence behind it. If verification fails, the change is rolled back automatically. Once monitoring is installed for the Project, its servers and Services report CPU, memory, disk, and health you can watch from your Workspace.

That is the whole shape: secure your servers, then run Projects on them. Under it all, one lifecycle holds every time: discover, assess, recommend, plan, approve, execute, verify, observe, record. You stay in control at every step.
