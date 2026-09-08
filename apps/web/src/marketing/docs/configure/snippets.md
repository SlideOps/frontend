# Snippets

Snippets are commands you have saved by name so you can pick them into any open terminal instead of typing them again. This page explains what a snippet is, what it deliberately is not, and how it is used.

Snippets lives under **Configure**, at `/app/snippets`.

## What a snippet is

A snippet is two things: a name and a command string.

That is the whole model. There are no variables, no templating, no arguments, and no relationship to any particular Server, Service, or Project.

The reason is the way terminals work here. A terminal is opened against whichever Server or Service you happen to be working on, and a saved command has to be usable from any of them. Tying a snippet to one Server would make it useless in every other terminal, and adding variables would turn a list of commands into a small programming language nobody asked for.

The library is scoped to your Workspace, so a team working in the same Workspace shares the same snippets.

## Saving a command

The **Save a command** panel takes a **Name** and a **Command**. Both are required.

A useful name says what the command is for rather than what it types: "Tail app logs" reads better in a list than "tail -f".

```bash
tail -f /var/log/app.log
```

Under the command box the panel states the rule that matters most:

> Typed into the terminal exactly as written. It is never run for you.

## How a snippet is used

A **Snippets** control sits at the end of the terminal's tab strip. Opening it lists your saved snippets by name; picking one types its command into the active tab.

It does not press enter, and it does not execute.

This is the whole safety model of the feature, and it is deliberate. A saved command is a convenience for your fingers, not an approval to run something. You see the command sitting at the prompt, in the terminal you are actually attached to, and you decide whether to run it there.

Nothing about a snippet goes through the Operation lifecycle. It is not planned, not approved, and not verified, because there is nothing to plan: a snippet is text, and the terminal it lands in is the same terminal you could have typed into yourself.

If you want something planned, approved, and verified, that is a **Capability**, not a snippet. See [Core concepts](/docs/start/core-concepts).

## Managing the library

Each saved snippet shows its name with the command beneath it in monospace, so you can read what a snippet actually does without opening it.

The pencil control edits the name and the command inline. The trash control removes it, after a confirmation:

> This removes the snippet from your library. It cannot be undone.

Removing a snippet has no effect on anything. It is a saved string; nothing depends on it.

## What snippets are good for

The commands worth saving are the ones you type often enough to mistype, and the ones whose exact form you would otherwise look up.

A few patterns that fit:

```bash
# Follow a unit's journal
journalctl -u myapp --since "10 minutes ago" -f

# What is listening, and on what
ss -tulpn

# Disk pressure, largest first
du -xh --max-depth=1 / | sort -rh | head -20
```

## What not to save in a snippet

Never put a secret in a snippet.

A snippet is stored as plain text and shown in full in the list, to everyone who can see the Workspace. It is not sealed, it is not masked, and there is no reveal control. A password on a command line is also visible in the process list on the Server and usually in that user's shell history.

If a command needs a credential, get the credential from [Credentials](/docs/configure/credentials), where it is sealed and revealed only when you ask, and supply it at the moment you run the command.

For the same reason, be careful with a snippet that is destructive out of context. The command is typed into whichever terminal is open, and a snippet written for a staging Server will type just as happily into a production one. Naming a snippet for where it belongs is worth the extra few characters.

## Roles

Saving, editing, and deleting a snippet all need a role above Viewer. A Viewer can read the library.

Using a snippet needs a terminal, and a Viewer cannot open one. See [Roles and permissions](/docs/account/roles-and-permissions).

## Related

- [Terminal](/docs/infrastructure/terminal) for where snippets are used
- [Credentials](/docs/configure/credentials) for the values that must not go in a snippet
- [Core concepts](/docs/start/core-concepts) for the difference between a command and a Capability
