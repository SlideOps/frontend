# Environment and secrets

A Service runs with a set of environment variables, and some of them are credentials. This page covers how they are stored, what the `secret:` prefix does, what `[stored securely]` means, the two ways to edit them and when to use each, and why a saved change is not a live change.

## The model

A Service's environment is **a list of variables, not a file**. Each one is treated on its own, and each one carries its own decision about whether it is sealed.

That matters more than it sounds. A file is all or nothing: to change one line you rewrite the whole thing, and anything you cannot read back you cannot rewrite. A list lets one variable be edited without touching the others, and lets a sealed value stay sealed while its neighbours are edited around it.

There are two kinds of variable:

- **Plain.** Stored as you typed it, readable later, shown behind a reveal on the Service page.
- **Sealed.** Encrypted into the secret store, never returned by the API, never written to a log, and revealed only to the deploy itself, in memory.

## Writing variables

Wherever you type an environment, the format is one variable per line:

```
DATABASE_URL=postgres://app@10.0.0.4:5432/storefront
LOG_LEVEL=info
PORT=3000
```

To seal a value, prefix the line with `secret:`:

```
DATABASE_URL=postgres://app@10.0.0.4:5432/storefront
secret:DATABASE_PASSWORD=hunter2
secret:STRIPE_SECRET_KEY=sk_live_...
LOG_LEVEL=info
```

Anything unprefixed is stored as you typed it and stays readable. Seal what is genuinely sensitive and leave the rest plain.

### Why sealing is explicit

SlideOps does not guess which of your variables are secret, because guessing is wrong in both directions. It either fails to recognise something and leaves a credential in the open, or it quietly makes a value you needed unreadable forever. This is your infrastructure, so the choice is yours to make knowingly.

There is exactly one exception, and it is the one case where there is nobody to ask: [adoption](/docs/build/deploying#environment-variables-on-adoption). A workload SlideOps did not deploy arrives with an environment nobody has classified, so anything that reads like a credential by name or by value is sealed on the way in, and you are told which before you adopt.

### What sealing actually means

A sealed value is **genuinely unreadable afterwards**, not merely hidden.

The plaintext lives only in the secret store. The Service record holds a reference to it and the literal marker:

```
[stored securely]
```

That marker is what every read sees: the API, the Service page, the environment diff, everywhere. There is no endpoint that returns it, no reveal button that would work, and no way for a screenshot or a screen share to leak it.

The consequence is the one thing to remember about sealed values: **you cannot get it back**. If you need to know the value later, keep it somewhere you can read it. SlideOps is not that place, by design.

## Reading the environment

On the Service's **Settings** tab, the environment is listed one variable per row.

Plain values are **masked by default**, behind a reveal. An environment is where the database password and the API keys live, so printing it on load would be wrong: it is readable over a shoulder, in a screen share, and in a screenshot. You reveal the one you need.

A sealed value has nothing to reveal, so its row says so:

```
Sealed: encrypted and never shown again
```

## Editing one variable

Each row has an **Edit** button. It opens that row alone, with two fields: the variable's name, and its value.

**This is the safe way to change one variable.** The request names one key and carries one variable, so nothing else can be lost by omission. Use it whenever you are correcting a single thing, which is most of the time.

### Editing a sealed value

The value box starts **empty**, not seeded with the marker. The marker is not the value, and saving it would store the literal words `[stored securely]` as your variable.

The rule is stated on the field itself:

> Leave empty to keep the current value; type a new one to replace it.

So:

| What you do | What happens |
| --- | --- |
| Leave the box empty | The sealed value is kept, untouched |
| Type a new value | The old sealed value is replaced |
| Want it gone entirely | Delete its line in the full editor. A single-variable edit cannot remove a variable |

Leaving it empty does not send an empty string. The editor sends an explicit "keep this value" instruction instead, precisely because an empty string already means "make this empty", and nobody opens an editor in order to blank a password.

### Renaming a variable

Change the name field. The editor warns you before you save:

> You are renaming `OLD_NAME` to `NEW_NAME`. Anything that still expects `OLD_NAME` will no longer receive it.

That warning is the point. A rename is not a cosmetic change: your application looks the old name up, and after this it will not be there.

Renaming a **sealed** variable works, and it is the only way to do it. The sealed value moves across untouched, because it is never read back to be renamed. The name changes; the secret does not move through your browser at all.

Two refusals worth knowing:

- Renaming onto a name that **already exists** is refused, rather than silently replacing a value you did not name. Choose another name, or edit the existing variable.
- Renaming a variable that is **no longer there** is refused, with a suggestion to reload and look at the current environment.

### Saving against a stale view

An edit carries the timestamp of the configuration as it was when you opened the editor. If the environment changed underneath you in the meantime, the save is refused:

> This service's configuration changed after this editor was opened, so saving would overwrite an edit you have not seen; reload and review the current values before saving.

This matters more than usual here, because a save writes the whole environment. A stale save would not merely lose the field in your hand; it would reinstate every other variable as your stale copy remembered them.

## Editing the whole environment

**Edit all** replaces the row list with a textarea holding every variable in the `KEY=value` form, sealed ones rendered as `secret:KEY=` with an empty value.

Use this to add several variables at once, to remove one, or to paste a set in.

### This list replaces what is there

The full editor sends the complete set. That has two consequences:

- **Deleting a line removes that variable.** This is the only way to remove one.
- **A variable you leave out is gone.** Not merged, not preserved. Gone.

A sealed line left with an empty value is read as "keep this one", which is what makes the round trip safe: reopening the editor and saving without touching anything does not blank every secret you have. But a sealed line you delete entirely takes the secret with it.

If you only want to change one thing, use the per-row Edit instead. A slip anywhere in that textarea can remove a variable you never meant to touch.

### Variable names

SlideOps refuses only what cannot survive in an environment at all: an empty name, a name containing an equals sign, and a name containing whitespace or a line break.

It deliberately stops there. The conventional `[A-Za-z_][A-Za-z0-9_]*` would be narrower, and a name is read by your application, not by SlideOps. Refusing a name your program actually looks up would break a working deployment to enforce a convention SlideOps does not own.

The deploy form's own textarea is a little stricter than the server, so a name it rejects may still be acceptable through the Service's editor.

## Comparing environments

The Settings tab has an environment diff: compare this Service against another software Service in the same Project, and copy a non-secret value across where they differ or where one is missing.

A sealed value is **never compared and never copied**. It reads as "set on both, hidden", because nothing about it can be synced without fetching and revealing a plaintext, which this deliberately never does.

This is the tool for "staging works and production does not", where the answer is usually one variable that never made it across.

## A saved change is not a live change

This is the single most important thing on this page.

**Saving records the change. A redeploy applies it.**

A container bakes its environment and its command in when it is created. Editing them changes what SlideOps has recorded about the Service; it does not reach into a running container and change what that process sees. There is no mechanism that could: the process was started with those variables, and it has them.

So after any save, the Service page shows:

> **Saved, but not yet running.** The container is still the one built from the previous configuration until you redeploy.

with a **Redeploy to apply** button beside it. That prompt stays until a deploy actually completes, at which point it is answered and clears.

SlideOps says this plainly rather than saving quietly and letting you assume it took effect. Assuming it took effect is how you spend twenty minutes debugging an application that is doing precisely what you told it to do yesterday.

### What redeploying also does

Applying a configuration change is not free of other consequences. A redeploy pulls the latest commit on the branch at the same time, so your environment edit and someone else's merge arrive together. If that is not what you want, see [Redeploying and rollback](/docs/build/redeploying-and-rollback).

### What does apply immediately

Only resource limits. Changing CPU, memory, or the process ceiling is applied to the running workload with no rebuild and no downtime. Everything else in the deployment configuration waits for a redeploy.

### Adopted Services

An adopted workload cannot be rebuilt by SlideOps at all, so there is nothing to apply a change with. Saving records what you want, and the page says so:

> This workload was already running when SlideOps found it, so SlideOps cannot rebuild it. Saving records what you want here, but applying it means recreating the workload yourself.

## What happens to a secret at deploy time

At the moment a deploy runs, sealed values are decrypted **in memory**, injected straight into the container or the unit, and used. They are not written to a temporary file on the server, not echoed into the deploy log, and not persisted anywhere outside the secret store.

If a secret cannot be revealed, the deploy fails before anything is started, rather than starting an application with a missing credential and letting it fail on its own terms later.

## What is recorded, and what is not

A configuration change appears in the Service's activity trail, listing the variables that moved **by name**. Never their values.

That restraint is what lets the activity trail live on the Service page in the open, next to the logs, rather than behind another permission. And it is exactly the information you want when something breaks: not what the values are, but that `DATABASE_URL`, `REDIS_URL`, and `CACHE_TTL` all changed nine minutes before the application became unhappy.

Deleting a Service with **Delete forever** removes its sealed secrets from the secret store along with the record. Removing a Service, or removing a variable from the environment, does not.

## Where to go next

- [Redeploying and rollback](/docs/build/redeploying-and-rollback) for what a redeploy does.
- [Services](/docs/build/services) for the rest of the Service page.
- [Troubleshooting](/docs/reference/troubleshooting) for an application that starts with the wrong configuration.
