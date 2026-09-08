# Activity

Activity is the record of every Operation SlideOps has run in this Workspace. This page explains what gets recorded, how to read one Operation's full history, and why a record exists even for the runs nobody was watching.

In the sidebar the entry is called **Activity**, under **Observe**. It opens at `/app/operations`, and the page itself is titled History. Both names point at the same thing: the list of Operations, newest first.

## What Activity records

An **Operation** is one run of a **Capability** against a **Node**. Installing PostgreSQL on a server, hardening SSH, creating a server user, applying pending updates: each of those is one Operation, and each one leaves a row here.

Every Operation carries:

- the Capability it ran, and the Node it ran on
- the Project, when it was run in the context of one
- its status, from `created` through to `completed`, `failed`, or `cancelled`
- the parameters it was given, with any secret value replaced by `[stored securely]`
- its **Plan**, exactly as it was approved
- its **Verification** result, with the evidence behind each check
- an ordered event log of everything that happened while it ran
- timestamps for creation, approval, start, and completion

Nothing here is reconstructed after the fact. Each of those values was written as the Operation moved through its lifecycle, so the record is the run rather than a summary of it.

### What is not an Operation

Activity is deliberately narrower than "everything that has happened". An Operation is something that goes through the full lifecycle: discover, assess, plan, approve, execute, verify, record. Plenty of useful things do not fit that shape and so do not appear here:

- Deploying, restarting, or reconfiguring a **Service**. That has its own record on the Service's own page.
- Opening a terminal. Nothing about a shell can be planned or verified, since planning one would mean predicting what somebody is about to type. Opening a shell is written to the audit trail instead.
- Reading. Discovery on its own, metrics, database browsing, and reports all observe without changing anything.

If you are looking for what happened to one application rather than to one server, the Service's own activity record is the better place. See [Logs](/docs/observe/logs).

## Reading the list

The list shows the newest Operation first. Each row gives you the Capability name, where it ran, when it was created, and a status badge.

Rows load fifty at a time. When there are more, a **Load more** button appears at the bottom rather than the whole history arriving in one request.

### Filters

Six tabs narrow the list:

| Tab | Shows |
|-----|-------|
| All | Every Operation |
| Required actions | Operations at `awaiting_approval` |
| Running | Operations at `executing` |
| Completed | Operations that finished and verified |
| Failed | Operations that could not be completed |
| Cancelled | Operations stopped before they finished |

**Required actions** carries a count badge when anything is waiting on you. That count is queried separately from the list, so it stays accurate no matter which page or filter you are looking at. It is the one number on this screen that answers "is SlideOps blocked on me right now".

### Statuses

The status values are the lifecycle itself, in order:

```
created → discovering → assessing → planning → awaiting_approval
        → approved → executing → verifying → completed
```

Two statuses leave that path: `failed`, when the Operation could not be completed, and `cancelled`, when it was stopped. An Operation at `completed`, `failed`, or `cancelled` is finished and will not change again.

If the SlideOps process is restarted while an Operation is mid-flight, that Operation is marked failed on startup rather than being left at `executing` forever. A run whose worker died is a run that did not finish, and the record says so.

## Reading one Operation

Open any row for the full record. The same screen serves a live Operation and one replayed from months ago, so there is nothing to learn twice.

### Before execution

While the Operation is at `created`, `discovering`, `assessing`, `planning`, or `awaiting_approval`, the screen shows the **Plan** and the approval controls.

The Plan is the whole proposal in the open: every step in order, each with its own risk, the rollback that would undo the change, and the strategy that will verify the result. **Approve and run** starts execution. **Cancel** stops it there.

Approval is a real gate. Nothing executes before you approve it, and the approval is recorded with its timestamp. What you approved is exactly what runs.

A **Viewer** sees the plan but not the buttons, and the card says so:

> Approving or cancelling needs a role above Viewer in this workspace.

### During and after execution

Once the Operation reaches `approved`, the screen changes shape:

- **Timeline** on the left, showing where the Operation is in the plan step by step.
- **Live output** in the middle, a terminal carrying the command output as it arrives. See [Logs](/docs/observe/logs) for how that stream behaves.
- **Verification** below it once the checks have run, listing each check and its evidence.
- A **Credentials** card, when the Operation created a credential such as a database password. See [Credentials](/docs/configure/credentials).

A **Cancel** button sits beside the live output while the Operation is running. Cancellation is checked between steps, so an Operation stops cleanly rather than mid-command.

### The live indicator

Top right, beside the status badge, a small indicator reports the state of the event stream: **Live**, **Reconnecting**, or **Stream closed**. It describes the connection to SlideOps, not the health of the Operation. A closed stream does not mean the Operation stopped; reload the page and the record is still there.

### How the event log works

Every meaningful moment in an Operation is stored as an event with a sequence number. There are five kinds:

| Event | Meaning |
|-------|---------|
| `operation.status` | The Operation moved to a new status |
| `operation.step` | A plan step started or finished |
| `operation.log` | Output from the work itself |
| `operation.verification` | A verification check produced a result |
| `operation.completed` | The Operation reached a terminal status |

Each carries a level of `info`, `warn`, or `error`.

When you open an Operation, SlideOps loads the stored events first and then subscribes to the live stream. Both feed the same view, merged by sequence number, which is why an Operation that is halfway through shows its whole history and then keeps going, and why an Operation from last month shows exactly what you would have seen at the time.

### Outcomes

- **Completed** reads: "The Operation completed and its result was verified." Verification always follows execution. An execution without verification is incomplete.
- **Failed** shows the error text the run produced. If the engine's rollback step actually ran, the heading says "The Operation failed and was rolled back". If no rollback ran, it does not claim one did. A **Retry** button takes you back to the Capability with the same Node and Project already selected.
- **Cancelled** reads: "This Operation was cancelled. Nothing further will run."

## Automated runs

An Operation created by an [Automation](/docs/automate/automations) records its origin as automated and links back to the Automation that produced it. It is otherwise an ordinary Operation: it runs the same lifecycle, verifies the same way, and lands in this same list.

The difference is approval. Setting up an Automation is your standing approval for its runs, so a scheduled Operation is auto-approved rather than waiting at `awaiting_approval`. Nothing else is skipped.

## Tidying the list

Finished Operations can be removed from Activity to keep it readable.

- The trash control on a row deletes that one Operation and its event log.
- **Clear finished** on the All tab removes every completed, failed, and cancelled Operation at once. On a status tab the button narrows to match: **Clear failed** on the Failed tab, and so on, so the action always matches what is on screen.

Two rules make this safe.

First, only a finished Operation can be deleted. Anything still planning, waiting on your approval, or executing stays where it is. Deleting one of those would orphan a change that is about to be written to a server.

Second, deleting a record changes nothing on your infrastructure. The confirmation says it plainly:

> It does not undo anything it did to your server: whatever it changed stays changed. The deletion itself is recorded in the audit trail.

That last clause matters. The audit trail is append only, so the fact that a record was removed outlives the record.

Deleting needs a role above Viewer. A Viewer sees no trash controls and no clear button.

## Why every action leaves a trace

The promise SlideOps makes is that nothing touches a server unseen. That promise is only worth something if it survives the moment: not just visible while it runs, but readable afterwards, by somebody who was not there.

So the plan you approved is stored, not just shown. The output is stored, not just streamed. The verification evidence is stored, so "it worked" can be checked rather than taken on faith. When something breaks three weeks later, the next attempt starts from evidence rather than from memory.

This is also what makes a shared Workspace workable. When several people can act on the same servers, the question is rarely "what is the state of this machine" and almost always "who changed it, when, and did they check". Activity answers that without anybody having to keep notes.

## Related

- [How an Operation works](/docs/start/core-concepts) for the lifecycle itself
- [Logs](/docs/observe/logs) for the different places output comes from
- [Reports](/docs/observe/reports) for the summarised view over the same data
- [Automations](/docs/automate/automations) for scheduled runs
- [Roles and permissions](/docs/account/roles-and-permissions) for who can approve and who can delete
