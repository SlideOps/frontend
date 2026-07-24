## Servers and Projects

SlideOps works in two levels. You secure servers once, then run Projects on them. Keeping the two apart is what lets one secured server carry several Projects, each with only the stack it needs.

### The server level

A server is one Linux machine you reach over SSH. At this level you connect a server, run the quick check (read-only Discovery and Assessment), and secure it. How many servers you can connect is set by your tier.

Securing a server means SlideOps never operates as root. You create a non-root administrator with full sudo, harden SSH so root can no longer sign in directly, and SlideOps switches its stored credential to the non-root account. The switch is verified before it happens, so you are never locked out. A server settings page then handles ongoing access: it rotates the connection credential and manages the accounts on the server.

### The Project level

A Project holds one stack and the Services that run it. You create a Project, assign one or more of your secured servers, install the Plugins the Project needs, optionally connect a GitHub repository, and deploy Services. A Project runs its Services only on the servers assigned to it.

### Core versus the marketplace

Only security is Core. Four security outcomes are pre-installed on every server with nothing to add: Secure SSH, the host Firewall, Create Application User, and Manage Packages and updates.

Everything else is a marketplace Plugin, installed per Project: containers, a reverse proxy, HTTPS, monitoring, backups, databases, runtimes, static sites, and extra security add-ons such as fail2ban, automatic updates, key-only SSH, and a read-only server audit. Because Plugins install into a Project rather than a whole account, each Project carries only the stack it uses. Installing a Python runtime into a Go Project would be waste, so you never have to.

### GitHub

You connect GitHub once, through your own OAuth app. SlideOps runs the authorize and callback and stores the token encrypted. A Service with a repository source clones on its first deploy, then pulls the branch you name on every redeploy, so there is no need to re-clone.

### Tiers and shared servers

Your tier (Free, Starter, Pro, or Enterprise) bounds how many servers, Projects, and Services you run, and the CPU, memory, and disk each Service may use. Because every Service runs under hard limits, several Projects can share one large server without fighting for resources.

Whichever level you are on, the lifecycle is the same: discover, assess, recommend, plan, approve, execute, verify, observe, record. Approval is always yours, and verification always follows execution.
