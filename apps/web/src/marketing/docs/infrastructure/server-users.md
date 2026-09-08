# Server accounts

Managing the login accounts on a Server through SlideOps, and what it means to
switch the account SlideOps signs in with.

Every Server has one account that matters more than the others: the **connection
account**, the one SlideOps signs in as. Everything SlideOps does on that machine
happens as that account. Understanding which account that is, and what changing
it does, is the difference between a Server that works and one that suddenly
cannot be reached.

Server accounts live under **Settings** on a Server's page.

## Reading the accounts

SlideOps lists the accounts by connecting over SSH and reading them. It changes
nothing: it reads the account list, the privileged group memberships, and the
account expiry state, and that is all.

Which accounts appear:

- `root`, always.
- Every account at or above the usual system uid ceiling of 1000 that has a real
  login shell.

Accounts with `nologin` or `false` as their shell are service accounts rather
than people, so they are left out even when their uid is high.

Each account carries markers:

| Marker | Meaning |
| --- | --- |
| **Administrator** | In a privileged group (`sudo` or `wheel`), or is `root` |
| **Limited** | An ordinary account with no sudo |
| **System** | Below the system uid ceiling. `root` is shown but marked System |
| **Connection account** | The account SlideOps signs in with |
| **Disabled** | The account exists and cannot be signed into |

### Why "Disabled" is not simply a locked password

A locked password on its own is not a disabled account, and reading it that way
would be wrong in the most misleading direction: nearly every key based account
has a locked password, because that is what a distribution does when an account
was never given one. Read naively, a working connection account would report
itself as disabled while its SSH key was being used every minute.

So for an ordinary account, SlideOps reads the **account expiry**, which is what
actually refuses a sign in whatever the account presents, key included. That is
exactly what disabling sets, which is what lets disable and enable round trip
cleanly.

`root` is the exception, and is read as disabled when its password is locked.
Disabling `root` only locks the password, deliberately, because expiring `root`
risks sudo.

## Creating or updating an account

Creating an account is a normal Operation. You describe what you want, SlideOps
plans it, you approve it, it runs, it is verified, and it is recorded.

You choose:

- **Username.**
- **Authentication method.**
  - *Password.* Optionally set or reset one. Left blank, the password is
    unchanged. It is sealed and never shown again.
  - *Private key.* No password is set. A fresh key pair is generated when the
    Operation runs, and the private key is shown once on the Operation's page for
    you to save.
- **Access level.**
  - *Limited*: a plain account with no sudo.
  - *Administrator*: full sudo, can act as root.

Running the same Capability again for an existing username updates it rather than
creating a second account, which is how you reset a password or change an access
level.

## Disabling, enabling and removing

Three separate Capabilities, and the difference between them is the difference
between reversible and not.

- **Disable** locks the account without deleting anything. Nothing in the home
  directory is touched. It can be opened again later.
- **Enable** reverses a disable and restores the password the account had before.
- **Remove** deletes the account and its home directory. It cannot be undone.

All three run as Operations you review and approve. Nothing happens at the moment
you press the button; you land on the Operation, at its plan.

Some accounts are protected and are never offered for removal:

- The **connection account**, because removing it would end SlideOps' own access
  to the Server.
- **`root`**, because the account has to exist. `root` can be disabled, which is
  the whole reason that Capability exists.
- **System accounts** other than `root`, which belong to the operating system
  rather than to a person.

Disabling is reversible and is usually what you want. Removal is offered behind a
second confirmation that says so.

## Switching account

Switching makes an existing account the one SlideOps connects with from now on.

### What it changes

Everything. After a switch, SlideOps signs in as the new account for:

- every Operation it runs on that Server
- every Discovery
- every deploy
- every terminal you open on the Server

The connection account is also what a Node terminal lands as, which is why the
terminal is unscoped: the credential already reaches the whole machine. See
[Terminals](/docs/infrastructure/terminal).

Most Capabilities need root on the Server and run under `sudo` when the connected
account is not already root. An account with no sudo will read a Server perfectly
well and will not be able to carry out most changes on it, so switching to a
limited account is a real reduction in what SlideOps can do there.

### What it does not ask you for

Nothing. Switching reuses the credential SlideOps generated when it created that
account, a password or a generated private key, so you never have to re-supply
it.

### It is verified before anything changes

The stored credential is tested against the Server with a live sign in, exactly
the way a manual credential rotation is. If it does not sign in, nothing is
changed and the previous account keeps working. The refusal says so.

### When switching is refused

Switching is only possible for an account SlideOps holds a generated credential
for. An account created by hand outside SlideOps, or created before this Server
used the account Capability, has no such credential, and the switch is refused
with `no_stored_credential` rather than silently failing later.

For those, rotate the credential manually instead: supply the username and the
key or password yourself, on the Server's Settings tab. That path verifies the
credential the same way.

Every switch is written to the audit trail.

## What SlideOps holds for each account

The account detail panel shows how to reach an account: the Server, its address,
its port, and the username.

- For the **connection account**, the stored credential itself can be revealed,
  copied, or downloaded, so you can use that account in another SSH client. It is
  the very credential you gave SlideOps.
- For **every other account**, SlideOps holds nothing. Those accounts are managed
  on the Server, and the panel says so plainly rather than implying a key it
  never had.

Revealing the connection credential needs a role above Viewer.

## Roles

Creating, updating, disabling, removing and switching accounts all need a role
above Viewer in the Workspace. A Viewer can see the account list, since knowing
who can sign in to a Server is context, not a change.

## A safe order of work

If you registered a Server as `root` and want to stop using `root`:

1. Create an **Administrator** account with a private key, and save the key when
   the Operation shows it.
2. **Switch** to that account. It is verified first, so if anything is wrong you
   are still on `root`.
3. Confirm SlideOps still works: run Discovery, open a terminal.
4. Only then **disable** `root`, or harden SSH.

Doing it in that order means every step is reversible at the point you take it.
