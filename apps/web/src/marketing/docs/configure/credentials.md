# Credentials

Credentials gathers every secret SlideOps holds on your behalf in one place: the SSH login it uses to reach each Server, and every credential a Capability created for you. This page explains what belongs here, how to reveal and copy a value, and the rules that govern how secrets are stored.

Credentials lives under **Configure**, at `/app/credentials`.

## What a credential is

Two different things live on this screen, and it helps to keep them apart.

**A Server login** is the credential SlideOps itself uses to sign in to a Node over SSH. You supplied it when you connected the Server, or the last time you rotated it. Every Node has one, whether or not anything has ever been run on it.

**A Capability credential** is something SlideOps generated while running an Operation: a database password, a service secret, a generated private key. It belongs to the Operation that created it, and through that Operation to a Node and, usually, a Project.

Both are sealed the same way, in the same store, and both are revealed the same way.

### What is not here

A Service's environment variables are not on this page. A value you marked as secret in a Service's configuration lives with that Service, is injected into the container at deploy time, and is edited on the Service's own configuration panel. It follows the same sealing rules described below.

## Finding a credential

The screen is a list on the left and a detail pane on the right, the way a password manager reads. On a narrow screen the list comes first and selecting a row replaces it with the detail, with an **All credentials** link back.

The list is grouped into **Servers** and **Databases**.

Two controls narrow it:

- **Search credentials** matches on the credential's name, its Server, and its Project.
- The **Project** filter shows only credentials belonging to one Project, or **No Project** for anything not assigned to one.

### Which Capability credentials appear

A Capability credential is listed when its Operation **completed** and stored at least one secret. A failed run may have sealed a value but produced no usable result, so it is not offered.

A bare install of one of the five database engines SlideOps knows how to manage is also listed even when it stored no secret at all, because a running, reachable database that is invisible on the credentials page is worse than a card with nothing on it yet.

When the same Capability has been run several times against the same resource on the same Server, for example because you rotated a database password, only the most recent run is listed. That is the credential that actually applies now. Earlier runs are still in [Activity](/docs/observe/activity) with their own records.

Two different resources are never collapsed. Two Services on the same Server each running a manage step create two different databases, each with its own real credential, and both are listed.

## Revealing and copying

Every secret is masked by default, shown as a short run of dots. The mask never contains a character of the real value, and its length is clamped so it does not leak how long the secret is.

The eye control reveals it. The first reveal fetches the plaintext from the server, once, and caches it for that page view. That is deliberate: until you ask, the real value is not in the page at all.

The copy control writes the real value to your clipboard and briefly confirms. Copying also triggers the fetch if you have not revealed the value yet, so you never have to show a secret on screen in order to copy it.

If the fetch fails, the control says so:

> Could not reveal this value. Try again.

### The Server login pane

Selecting a Server shows:

- **Host**, its address and port
- **Username**, the account SlideOps signs in as
- **Password** or **Private key**, whichever kind of credential is stored, behind a reveal control

**Download** writes an env file containing the host, port, username, and the credential, named for that Server. It is the same secret you could reveal by hand, prepared in a form another tool can read.

### The database pane

Selecting a database credential shows the connection details as copyable rows, each secret behind its own reveal control, and then up to two ready-made connection strings.

**Connection string, from a container on this Node** comes first, because it is the common case. A database installed on a Node is not reachable at the Node's public address by design; a container running on that same Node reaches it at the Docker bridge address instead. This is the string to put in a Service's environment.

**Connection string, from outside this Node** is offered when the Node has a public address. It works only if that Node's firewall was explicitly configured to allow a remote connection, which is not the default, and the card says so.

Both are shown with the password masked. **Reveal and copy connection string** fetches the secret, assembles the full URL, shows it, and copies it in one action. **Hide** puts it back.

Under each, **Or copy the parts separately** opens the same endpoint as individual values: host, port, username, database, and a revealable password. Some applications read one `DATABASE_URL` and some read `DB_HOST` and `DB_PORT` separately, and pasting a whole URI into a host setting fails with a name lookup error:

```text
getaddrinfo ENOTFOUND postgresql://user:password@host:5432/database
```

Both shapes are offered so the right one is available rather than improvised.

### A generated private key

When an Operation generated a private key for you, it gets its own card with **Copy private key** and **Download** as a `.pem` file, rather than the single masked line every other secret gets. This is the one secret you are expected to save to a file and use in another SSH client.

The card says what it means:

> Generated for this account and installed on the server. This is the only time it is shown here, save it now. It stays revealable through this Operation's own record if you need it again, but is never shown anywhere else.

## Downloading

**Download** on a detail pane writes that one credential to an env file. The connection details are written as plain lines and each sealed secret is fetched and written alongside them.

**Download all**, in the page header, does the same for every credential currently visible, into a single `slideops-credentials.env`.

Secrets fetched for a download are held only in the text that becomes the file. They are never placed in a URL and never logged.

Treat the downloaded file as you would any other secret material. SlideOps has no way to un-download it.

## Acting on a database from here

For the five database engines SlideOps knows how to manage, the detail pane also carries controls for the running thing the credential is for.

**Manage** opens the engine's Capability page. **Start**, **Stop**, and **Restart** act directly over the SSH connection SlideOps already holds. There is no separate pause: a service has nothing between running and stopped, so Stop is what a pause actually is.

**Delete** does not tear anything down from this page. It creates the real removal Operation and hands you straight to it, to review the plan and approve, exactly like starting any other Capability. A checkbox lets you also delete the engine's data. Removing a database is not a decision this page makes on its own.

### Connecting a database to a Service

The detail pane also shows **Used by**, listing every Service already wired to this exact database, and a picker to connect another.

Only a software Service in the same Project, on the same Node, can be a target. A Capability Service has no environment of its own to receive a connection, and nothing here wires across Project boundaries silently. Connecting writes the connection into the Service's environment and redeploys it to apply.

## The rules about secrets

These rules hold everywhere in SlideOps, not just on this page.

**A secret is sealed the moment it arrives.** It is encrypted and written to the secret store before anything else happens to it. The plaintext is decrypted only at the moment it is needed, for example to open an SSH connection or to inject an environment variable into a container as it deploys.

**A sealed value is never readable back through an ordinary read.** Wherever a record would have carried the value, it carries the literal marker instead:

```text
[stored securely]
```

You will see that marker in an Operation's parameters, in an Automation's saved inputs, and in a Service's environment. It is not a display convention applied at the last moment. It is what is actually stored in that field, and what the API actually returns.

**The plaintext comes back only through an explicit reveal.** Revealing is its own request, made only when you press the control. Nothing loads secrets speculatively.

**A secret is never written to a log.** Not to the Operation's output, not to the server's logs, not to SlideOps' own structured logs.

**Nothing guesses which of your values are secret.** SlideOps does not scan a Service's environment and decide for you, because guessing is wrong in both directions: it either misses something and leaves it in the open, or quietly makes a value you needed unreadable. You mark what is secret. The one exception is a workload you adopt, where there is nobody to ask, so anything that reads like a credential by name or by value is sealed on the way in.

**A blank field keeps the existing secret.** Because a sealed value genuinely cannot be read back, its line comes back empty when you edit it. Leaving it empty keeps what is already there. Only typing over it replaces it, and only removing the line removes the value.

## Roles

Revealing a credential is a write request, not a read, so it needs a role above Viewer. A Viewer can see that a credential exists and where it lives, but cannot reveal, copy, or download its value, and cannot start, stop, or remove anything from this page.

See [Roles and permissions](/docs/account/roles-and-permissions).

## Related

- [SSH keys](/docs/configure/ssh-keys) for the key library and rotating a Server's login
- [Activity](/docs/observe/activity) for the Operation a credential came from
- [Security](/docs/account/security) for your own account credentials
- [Terminal](/docs/infrastructure/terminal) for signing in to a Server directly
