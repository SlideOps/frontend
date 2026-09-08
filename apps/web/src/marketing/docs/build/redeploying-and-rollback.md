# Redeploying and rollback

Redeploy is the action that applies a configuration change and takes the newest code. Rollback is a narrower thing than it sounds, and knowing exactly what it covers is worth more than assuming. This page is about both.

## Redeploy, restart, and start: three different things

They sit next to each other on the Service page and they are easy to confuse.

| Action | What it does | When to use it |
| --- | --- | --- |
| **Start** | Starts a stopped workload, as it already exists | You stopped it and want it back |
| **Restart** | Bounces the existing workload. No pull, no rebuild, no configuration change | The process is wedged and you want it to begin again |
| **Redeploy** | Re-runs the whole deploy: pull, rebuild, rerun | You changed the configuration, or the branch moved |

Restart is the one people reach for when they mean Redeploy. A restart of a container is the same container, with the same image and the same environment it was created with. It cannot pick up an edit you saved, because nothing was rebuilt.

## What a redeploy does

A redeploy re-runs the Service's deploy from scratch, with the configuration as it stands right now.

For a **repository** source, that means:

1. Fetch the branch and reset the checkout to its head, so the newest commit on that branch is what gets built. On the very first deploy this is a shallow clone; afterwards it is a fetch, so nothing is re-cloned.
2. Rebuild the image from the Dockerfile.
3. Recreate the workload with the current command, environment, ports, and limits.
4. Check that it is genuinely running rather than crash-looping.
5. Record the commit it built from.
6. Clear the "saved, but not yet running" prompt, because it has now been answered.

For an **image** source it is the same, minus the clone and the build: the image is pulled and the workload recreated.

The Service goes back to `deploying` while this happens, and the page updates on its own until it settles at `running` or `failed`.

## Redeploy is what applies a configuration change

A container bakes its environment, its command, its ports, and its source in when it is created. Editing any of those records what you want; it does not change what the running process sees.

So after a save, the Service page shows:

> **Saved, but not yet running.** The container is still the one built from the previous configuration until you redeploy.

with **Redeploy to apply** right there. See [Environment and secrets](/docs/build/environment-and-secrets) for how the saving works.

The one exception: **resource limits apply immediately**, in place, with no rebuild and no downtime.

## Redeploy always takes the newest commit

This is the part that surprises people.

A redeploy does not replay the deploy you did last time. It fetches the branch and resets to its head. If somebody merged three commits since your last deploy, you get all three, along with your environment edit.

That is the right default: "redeploy" meaning "run last week's code again with today's variables" would be a strange thing to want, and would silently diverge from the branch. But it does mean a redeploy to apply a one-line configuration change also ships whatever else has landed.

If that is not what you want, deploy from a branch you control, or pin the branch to the commit you intend before redeploying.

### Knowing what is waiting

The Service's Overview tab shows the commit it is currently running, and an update check compares it against the head of its branch. The check only observes: it never changes the Service.

Three outcomes:

- **Update available.** The branch has moved ahead, with the new commit named. **Deploy latest** redeploys to it.
- **Up to date.** Nothing is waiting.
- **A reason.** For an image source, or a Service that has not deployed from a commit yet, the check says why there is nothing to compare rather than reporting a misleading "up to date".

## What cannot be redeployed

Three cases, each refused with its reason:

- **An adopted Service.** SlideOps did not build it, so it has nothing to rebuild it from. The Redeploy button is not offered.
- **A removed Service.** Its record survives so you can still see its history, but its workload was torn down and it can never be redeployed.
- **A Capability Service.** There is no single workload to rebuild. Its Capabilities are grown with **Add a Capability** and reconfigured through their own Configure actions.

## Cancelling a deploy

While a deploy is in flight, Cancel is the only lifecycle action offered.

**Cancelling stops the work, it does not undo it.** A build that had begun is abandoned. Whatever the previous deploy left running on the server is untouched, which is exactly why this is a separate thing from removing the Service.

The Service is marked `failed`, and the reason is recorded. Redeploy to try again.

If the API restarts while a deploy is in flight, the deploy is marked as interrupted with the reason recorded, and the fix is the same: redeploy.

## Rollback

Here is where the vocabulary needs care, because "rollback" means one specific thing in SlideOps and not the thing you might expect.

### There is no rollback to a previous release

**SlideOps does not keep previous deployments to switch back to.** There is no deployment history to pick from, no "previous image" retained, and no rollback button on a Service.

A Service records **the commit it is currently running**, and nothing more. A deploy moves forward.

This is a real limit and it is better stated plainly than discovered at the worst moment. To go back to an earlier version, you make the earlier version the current one: pin the branch, or point the Service's source at a different branch or a different image tag, and redeploy. The deploy is then a normal forward deploy, planned and verified like any other.

### What rollback does mean

Rollback belongs to the **Operation** lifecycle, not to Services.

When a Capability runs as an Operation, its plan includes a rollback: in words, before you approve, what would be done to undo this change. That rollback runs automatically when:

- execution returns an error,
- verification does not pass,
- a credential the Operation generated could not be sealed safely, or
- a cancellation interrupts a step so that execution ends in an error.

What it restores is defined by the Capability. For a configuration file it means putting back the most recent backup and reloading the service. For something that was only created, it means removing it again.

This is what stands behind "a failed verification rolls the change back": the SSH hardening that would have locked you out is undone, on the spot, using the backup taken before the change. See [How an Operation works](/docs/start/how-an-operation-works).

### What Operation rollback does not cover

Being precise about the boundaries:

- **It is a whole-plan undo, not per-step compensation.** The Provider is handed the plan, not a record of which step failed.
- **It only restores what the Capability took a backup of.** Backups are per Capability plan steps, not a universal snapshot. A step that deletes a data directory says in its risks that it cannot be undone, and it means it.
- **It never restores data.** A dropped database is dropped. Restoring from a dump is a separate, deliberate Operation with its own plan.
- **It does not run for an Operation interrupted by a restart.** The process that would have performed it is gone. Those Operations are marked failed with the reason recorded, and the screen does not claim a rollback that never happened.
- **It does not apply to Services at all.** Deploying, starting, stopping, and removing a Service do not go through the Operation gate, so they have no plan and no rollback.

The screen is careful about this too: an Operation only says it was rolled back when a rollback actually ran.

## Removing and deleting

Neither of these is a rollback, and both are covered here because they are the other way a deploy gets undone.

**Remove** stops and tears down the workload and frees its allocation. The Service record stays, so its history is still readable, and it can never be redeployed.

- For a **Compose** Service, the stack is brought down and orphans removed, but **volumes are left**. They hold data SlideOps did not create and must not destroy as a side effect.
- For an **adopted** Service, Remove releases it from management. It keeps running, untouched.
- For a **Capability Service**, every Capability that finished installing is uninstalled, unless another Service on the same server still depends on one. A separate checkbox also destroys each Capability's data, which is permanent and off by default.

**Delete forever** permanently removes the record, the activity trail, and any sealed secret the Service holds. It cannot be undone, so it asks you to type `delete <the Service's name>` exactly.

## A practical sequence

The shape of a normal change:

```
1. Edit the environment on Settings, or push to the branch.
2. Check the update panel to see which commit you are about to take.
3. Redeploy.
4. Watch it settle. If it fails, the reason is on the page and in the activity trail.
5. If it fails to come up, run Diagnose from the Logs tab.
6. To go back: point the source at the version you want, and redeploy again.
```

## Where to go next

- [Environment and secrets](/docs/build/environment-and-secrets) for what you are applying.
- [Services](/docs/build/services) for the rest of the lifecycle actions.
- [Troubleshooting](/docs/reference/troubleshooting) for a redeploy that did not work.
