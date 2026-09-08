# Workspaces and teams

A Workspace is a container for infrastructure and the people allowed to touch it. This page explains what a Workspace holds, how to move between them, how to invite people, and how a shared Workspace differs from your own.

## What a Workspace is

A Workspace holds its own Servers, Projects, and Services, and its own team.

Every one of those resources carries the Workspace it belongs to, and that is what every request reads and writes by. Two Workspaces never see each other's Servers, Projects, Operations, credentials, SSH keys, or snippets. There is no "all Workspaces" view of infrastructure anywhere in the product.

The record of who did what is kept separately from that. Every Server, Project, Service, and Operation also records the Operator who actually created or ran it, so a shared Workspace still answers "who did this" without the resources belonging to that person.

### Your Personal Workspace

Every account gets one Workspace at registration, named **Personal**. It is created once, made active immediately, and cannot be deleted.

That permanence is the point. However many Workspaces you create, and however many memberships are later revoked, there is always somewhere to land and somewhere to move a resource back to.

### Creating more

Create a Workspace for anything that deserves its own boundary: a client, a team, a side project, production kept apart from experiments.

A new Workspace starts genuinely empty. No Server, no Project, nothing carried over.

How many you may create is set by your plan, counted across your whole account and including Personal. Over the limit, creation is refused with the plan's own message:

```text
the free tier allows at most 1 workspaces
```

See [Billing](/docs/account/billing) for the numbers.

## Switching between Workspaces

The switcher sits at the top of the sidebar and shows the Workspace you are acting in now. Opening it lists every Workspace you can act in, each with a subtitle reading **Personal** or your role in it.

Switching is instant and persists. The active Workspace is stored on your account, not in the browser tab, so it survives signing out and back in and follows you between devices.

Everything below the switcher is scoped to the Workspace above it. Which Workspace you are in is not one setting among many; it is the frame everything else happens inside.

**Create workspace** at the bottom of the switcher takes just a name and drops you straight into the new Workspace. **Manage workspaces** opens the hub.

### The Workspaces hub

`/app/workspaces` lists everything you can act in, split into **Your workspaces** and **Shared with you**.

Each card offers **Switch to this**. On a Workspace you own, it also offers **Rename** and, unless it is your Personal one, **Delete**.

Deleting is refused while the Workspace still owns a Server or a Project:

```text
this workspace still has servers or projects in it
```

Move or remove those first. This is deliberate: deleting a Workspace must never be a way to lose track of a running machine.

## Inviting people

The **Team** screen, at `/app/team`, is who can act in the current Workspace and at what level.

**Invite a teammate** takes an email address and a role: **Admin**, **Member**, or **Viewer**. The form describes each as you choose it:

| Role | Description shown |
|------|-------------------|
| Admin | Full operational access, and can manage the team. |
| Member | Full operational access. Cannot manage the team. |
| Viewer | Read-only everywhere in this workspace. |

Owner is not offered, because Owner is not something you can be invited as. See [Roles and permissions](/docs/account/roles-and-permissions).

Inviting, changing a role, and removing someone all need Owner or Admin. Everyone else sees the team list with the controls absent and this line beneath it:

> Only an Owner or an Admin can invite, change a role, or remove someone.

### What the invited person gets

Two things, both best effort.

An email with a link to accept. If the email cannot be sent, the invitation still exists: the pending row and its token are the real thing, and the link can be shared by hand.

And, if that email address already has a SlideOps account, an in-app notification, plus a **Waiting for you** card on their Workspace home and on their Workspaces hub with **Accept** and **Decline** on it. That matters because an invitation should be discoverable the next time somebody signs in, not only on a page they might never think to open.

### Accepting

The invitation link works whether or not the recipient has an account yet. Signed out, it shows what they are being invited to and offers **Sign in to accept** or **Create an account**, returning them to the invitation afterwards.

Signed in, it names the account they are signed in as and offers **Accept invitation**, **Decline**, and a way to sign in as somebody else.

An invitation is bound to the email it was sent to. Accepting from a different account is refused:

```text
this invitation was sent to a different email
```

On acceptance the new Workspace becomes their active one, and the person who created the Workspace gets a notification saying who joined and at what role.

### Pending, and withdrawing

An invitation stays **Pending** until it is accepted, then becomes **Active**. There is no third state.

The team list shows both, with **Since** reading the date it was accepted or the date it was sent.

A pending invitation's role cannot be edited in place. Withdraw it and send a new one at the role you want.

There is no resend. If a link goes missing, either share the same link again or withdraw the invitation and issue a fresh one.

### Removing someone

**Remove** on an active member, or **Withdraw** on a pending invitation, both delete the row. A removed member loses access immediately, and there is nothing left for them to look back on.

If the Workspace they were removed from was their active one, their active Workspace resets to their own Personal Workspace, so their next request lands somewhere they still belong.

## Seats

A seat is a person who can act in a Workspace. Both active members and pending invitations count, because an invitation that has not been accepted yet still reserves the seat it will fill.

The seat limit comes from the plan of whoever **created** the Workspace, not from the plan of the person doing the inviting. Over the limit, the invite is refused:

```text
the starter tier allows at most 2 seats
```

The Workspace home shows your plan's seat allowance in its tier panel, alongside the Workspace, Server, and Project limits.

## Shared Workspaces and your own

The mechanics are identical. A shared Workspace is not a different kind of object; it is a Workspace that other people hold memberships in.

What differs is what you can do, and that depends entirely on your role in the Workspace you are currently acting in. You are always the Owner of your own Personal Workspace, whatever role you hold elsewhere. Being a Viewer in a client's Workspace does not limit you in your own.

Two things do not follow the Workspace switch.

**Billing follows the account.** A subscription belongs to the account paying for it. Acting in somebody else's Workspace does not let your checkout, promo code, or cancellation land on theirs. See [Billing](/docs/account/billing).

**Plan limits come from the Workspace's creator.** A Workspace has no plan of its own, so how many Servers and Projects it may hold, and how many seats it carries, come from the account that created it. The usage counted against those limits is the Workspace's own, whoever in it created each thing.

## Moving a Server to another account

Resources do not move between Workspaces inside one account. A Service can move between Projects, and a Server can be assigned to a Project, but there is no "move this to another Workspace" control.

There is one handoff, and it crosses accounts: **Transfer ownership**, on a Server's own page. It offers that Server and everything scoped beneath it, its Project if it has one to itself, every Service, installed plugins, history, and the credential, to a different Operator by email.

Nothing moves until they accept. They choose which of their own Workspaces it lands in, defaulting to their Personal one. It is refused while the Server has an Operation in progress, when the Server's Project is shared with another Server, and when the destination is already at its Server limit.

Offering and cancelling a transfer need Owner or Admin. Accepting one is judged by the receiving account, not by any role in the sending Workspace.

Incoming offers appear on the Workspaces hub under **Nodes offered to you**, and are folded into the same count on the switcher badge as pending invitations, since both are things waiting on you.

## Related

- [Roles and permissions](/docs/account/roles-and-permissions) for exactly what each role can do
- [Billing](/docs/account/billing) for Workspace, seat, Server, and Project limits
- [Security](/docs/account/security) for protecting your own account
