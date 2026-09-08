# SSH keys

SSH Keys is a library of named private keys you can reuse across Servers instead of pasting the same key at every registration and every rotation. This page explains how SlideOps authenticates to a Server, how to add and rotate keys, and what happens when a Server's host key changes.

SSH Keys lives under **Configure**, at `/app/ssh-keys`.

## How SlideOps reaches a Server

SlideOps connects to your Servers over ordinary SSH. There is no agent to install and nothing runs on the machine on SlideOps' behalf between connections.

Every Node stores one credential of its own: an SSH username, and either a private key or a password. That credential is encrypted the moment it arrives, decrypted only at the moment a connection is opened, and never returned by the API or written to a log.

A private key is the stronger choice, and it is the one that lets SlideOps harden SSH on the Server later without locking you out. If password sign-in is disabled during hardening and your credential was a password, you lose the connection. If it was a key, nothing changes.

## What the key library is for

Without the library, a key that reaches four Servers has to be pasted four times, and rotating it means pasting it four more.

Saving a key gives that same secret a name and a fingerprint you can recognise, so it can be picked from a list instead. One key can back as many Servers as you like.

The library is scoped to the Workspace. Keys saved in one Workspace do not appear in another.

## Saving a key

The **Save a key** panel takes a **Name** and the **Private key** itself.

On save, SlideOps validates that the key material parses as a private key and computes its fingerprint. An unusable key is refused there and then, rather than at the moment you try to connect a Server with it.

The panel says what happens to it:

> Stored encrypted the moment it arrives. It is never shown again.

That is literal. Unlike a credential a Capability generated for you, a key you imported is not revealable through the interface. SlideOps uses it to sign in; it does not hand it back.

Each saved key shows its name and its fingerprint, in the same `SHA256:` form `ssh-keygen -lf` prints. The fingerprint is how you tell two keys apart without seeing either.

Use the pencil control to rename a key. Renaming changes only the label.

## Using a saved key

Once you have at least one key saved, two places offer it.

### Connecting a Server

The **Credential** step of connecting a Server offers a choice between **Paste a credential** and **Use a saved key**. Choosing the second gives you a picker showing each key by name and fingerprint.

The radio pair only appears once you have saved a key. With an empty library there is nothing to choose between.

### Rotating a Server's credential

**Change connection credential**, on a Server's own page, changes what SlideOps signs in with. It takes the same choice: paste something new, or pick a saved key.

You can also change the connection username at the same time, which is how you move SlideOps from the bootstrap account you started with onto a proper one.

Rotation is verified before it is applied:

> It verifies the new credential can sign in before switching, so a wrong one changes nothing and you are never locked out.

SlideOps opens a connection with the new credential first. Only if that connection succeeds is the stored credential replaced. If it fails, you get:

> That credential could not sign in, so nothing was changed. The current credential still works. Check the account and secret, then try again.

Rotation needs a role above Viewer.

## Removing a key

Removing a key removes the **name** from your library. It does not touch the underlying secret, and it does not touch any Server.

Before you confirm, SlideOps counts how many Servers currently record that key and tells you:

> This name is used by 3 servers. Removing it only removes the name from your library: those servers keep connecting exactly as before.

When nothing uses it, the confirmation reads:

> This removes the name from your library. Nothing that used it is affected.

That count is honest information, not a safety gate. Each Server's own credential is a separate sealed secret; the library entry is a convenience for picking it again. Deleting the name means you can no longer pick that key for a new Server, and nothing more.

## Host keys and what happens when one changes

This is the other direction of trust: not how SlideOps proves itself to your Server, but how it knows it is talking to the right Server.

SlideOps uses trust on first use. The first successful connection to a Node records that Server's host key fingerprint. Every connection after that verifies the presented host key against the recorded one, and refuses to proceed if they differ.

This is not optional and cannot be turned off. SlideOps never ignores a host key.

### When a mismatch happens

A host key changes for two reasons: because the machine was rebuilt or its SSH host keys were regenerated, or because something is answering at that address that is not your Server.

SlideOps cannot tell those apart, so it refuses the connection either way. Whatever you were trying to do fails with the reason attached rather than a generic "could not connect". Opening a terminal on a Service, for example, reports:

```text
a shell could not be opened in this service: ssh host key does not match the trusted fingerprint
```

The reason is carried through deliberately. A Server that cannot be reached, a Service that is stopped, and a Server whose host key has changed are three different problems, and only one of them is worth being alarmed about.

### What to do about it

First, find out why the key changed. If you did not rebuild or reprovision that machine, treat the mismatch as the warning it is and investigate before doing anything else.

If the change was expected, SlideOps has no control today for accepting a new host key on an existing Node. The pinned fingerprint is recorded once, on first connect, and there is no in-app way to clear it. Remove the Server from SlideOps and connect it again: the first connection to the re-registered Server learns the new fingerprint, exactly as it did the first time.

## Related

- [Credentials](/docs/configure/credentials) for the credential values SlideOps holds, including each Server's login
- [Terminal](/docs/infrastructure/terminal) for the interactive session over the same connection
- [Roles and permissions](/docs/account/roles-and-permissions) for who may rotate a credential
