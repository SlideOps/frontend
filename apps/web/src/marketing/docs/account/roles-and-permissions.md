# Roles and permissions

There are four roles in a Workspace: Owner, Admin, Member, and Viewer. This page states precisely what each one can do, and how that is enforced.

Read this page before you invite anyone. People make security decisions from it.

## The four roles

| Role | Operational access | Team management | How you get it |
|------|--------------------|-----------------|----------------|
| Owner | Full | Yes | You created the Workspace |
| Admin | Full | Yes | Invited or promoted |
| Member | Full | No | Invited or promoted |
| Viewer | Read only | No | Invited or demoted |

### Owner

Owner is whoever created the Workspace. It is not a membership you can be granted: there is no Owner option when inviting, and no row anywhere recording somebody as Owner. It is derived from who created the Workspace.

You are always the Owner of your own Personal Workspace.

There is **no ownership transfer**. A Workspace's Owner is its creator, permanently. The nearest thing is transferring a single Server to another account, described in [Workspaces and teams](/docs/account/workspaces-and-teams).

### Admin

Full operational access, plus the ability to manage who else is in the Workspace.

### Member

Full operational access. Identical to Admin in everything that touches infrastructure. The only difference is that a Member cannot manage the team.

That is worth saying plainly, because the names suggest a gradient that does not exist. A Member can connect a Server, approve an Operation, deploy a Service, open a terminal, rotate a credential, and remove a database, exactly as an Admin can. Admin adds one thing: control over the team itself.

### Viewer

Read only, everywhere in the Workspace.

## What a Viewer can do

A Viewer can read everything in the Workspace: Servers and their discovered facts, Projects, Services and their live logs, Capabilities, Operations and their full records, Automations, domains, the network, reports, the team list, and the plan and usage.

## What a Viewer cannot do

**A Viewer cannot write anything.** Not one thing, anywhere in the Workspace. No creating, no editing, no deleting, no approving, no deploying, no starting or stopping, no rotating a credential, no revealing a secret.

A refused write returns HTTP 403 with the message:

```text
your role in this workspace is read only
```

**A Viewer cannot open a terminal**, on a Server or on a Service.

That deserves its own sentence because it is the one case a general read-or-write rule would get wrong. A terminal opens over a WebSocket, and a WebSocket handshake is a GET request by protocol; there is no other verb it could use. Judged by method alone, a terminal reads like a read.

It is nothing of the sort. A terminal is the most write-capable thing in the product: everything typed into one happens outside every Capability, plan, approval, and verification. So the role is checked in the terminal handler itself, using the same rule, and checked **before** SlideOps dials your Server. A refused terminal connects to nothing and records no session as opened.

The refusal is written into the terminal you are looking at:

> Your role in this workspace is read only, and a terminal is not.

Note that the Terminal is still visible in the navigation for a Viewer, and terminal tabs can still be opened. The refusal appears inside the terminal rather than the entry being hidden.

## What only an Owner or an Admin can do

Some actions need more than full operational access, because being allowed to change infrastructure is a different question from being allowed to change who else can.

- Invite a teammate
- Change a member's role
- Remove a member, or withdraw a pending invitation
- Rename the Workspace. The API accepts this from an Admin; the Workspaces hub currently offers the control only on a Workspace you own.
- Offer a Server to another account, and cancel that offer
- Enable, disable, join, or reconcile the Workspace's private network
- Change DNS provider and ingress settings

Reading any of those is open to every role. A Member or a Viewer can see the team list, the network state, and a pending Server transfer, without being able to change them.

A refusal here reads:

```text
this action requires a higher role in this workspace
```

## What only an Owner can do

**Delete the Workspace.** Not an Admin, not anyone else. And even for the Owner it is refused while the Workspace still owns a Server or a Project, and always refused for the Personal Workspace.

## What is not judged by your role at all

A few things sit outside the Workspace, and so outside its roles.

**Your own account.** Your password, two step verification, and sessions belong to you, not to any Workspace. See [Security](/docs/account/security).

**Workspace identity.** Listing the Workspaces you can act in, switching between them, creating one of your own, renaming or deleting one you own, and accepting or declining an invitation.

Switching is deliberately not judged by your role in the Workspace you are leaving. A Viewer in one Workspace moving to another is not a write to the first, and accepting an invitation into a different Workspace entirely cannot sensibly be judged by a role in the one your session happens to be in.

**Your own interface preferences**, such as a collapsed sidebar. Being read only in somebody else's Workspace should not mean navigating with an interface that forgets everything.

**Billing.** A subscription belongs to the account paying for it, never to the Workspace it is currently acting in. Your billing is yours regardless of what role you hold anywhere.

## Roles are per Workspace

Your role is a property of the Workspace you are acting in right now, not of your account.

You can be an Owner in one Workspace, a Member in another, and a Viewer in a third, in the same session. Switching Workspaces changes what you can do immediately.

You are always the Owner of your own Personal Workspace, so being a Viewer somewhere else never limits what you can do in your own.

## How this is enforced

**Authorization is enforced by the backend, on every request.**

Every request carries the acting Operator, resolved from the session, and the Workspace being acted in, resolved from the account's stored active Workspace. Those two resolve a role, and the role decides whether the request proceeds. That check runs on the request itself, not on the page that sent it.

**What the interface shows is a convenience, never the boundary.**

Write controls hide themselves for a Viewer, and pages that exist only to create something show a "This needs a role above Viewer" state instead. That is a courtesy: a role is not a secret, and offering a button that cannot work is a worse experience than not offering it.

It is not the security model. Hidden controls do not protect anything, and the interface has no authority to grant access. If a client is modified, an old page is left open, or a request is made directly against the API, the answer is the same 403 it always was.

The two places this is most visible are worth remembering:

- The Terminal is not hidden from a Viewer, and the refusal comes from the server, in the terminal.
- Revealing a credential is a write request, not a read. A Viewer can see that a credential exists and cannot reveal, copy, or download its value.

## The platform Admin role

Separately from Workspace roles, an account can carry the platform **admin** role. That is not a Workspace role, is never granted by inviting somebody, and does not appear in a team list. It opens the control plane for whoever operates this SlideOps deployment.

An account with that role is unlimited by role: it is not metered and never needs a subscription.

In production, an admin account must have two step verification enabled before the control plane will open. Without it, the request is refused with a message naming where to fix it:

> the admin area needs two step verification on this account; turn it on under Security, then come back

## Related

- [Workspaces and teams](/docs/account/workspaces-and-teams) for inviting, switching, and seats
- [Security](/docs/account/security) for your own account protections
- [Terminal](/docs/infrastructure/terminal) for what a terminal actually is
