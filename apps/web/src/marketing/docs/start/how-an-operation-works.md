# How an Operation works

An Operation is one run of a Capability against a Node, from plan to verification. It follows the same lifecycle every time, so there are no surprises. This page walks through what happens between the moment you start one and the moment it is recorded, and explains why approval and verification are not optional.

## The lifecycle

```
Discover → Assess → Recommend → Plan → Approve → Execute → Verify → Observe → Record
```

Every Capability runs all of it. There is no fast path, no "just do it", and no way to skip to execution.

The first four stages happen before you have agreed to anything, and they touch nothing. The gate sits in the middle. Everything after it is proof.

## Discover

The Operation begins by reading the Node again.

Not by recalling what it saw last time: by connecting and looking. The plan is built from the machine as it is right now, because a plan built from a stale picture is a plan for a machine that no longer exists. Discovery reads the operating system and its family, the package manager, the init system, what is installed, what is listening, and the SSH posture.

**Discovery only observes.** It never modifies anything, on any code path, for any Capability. This is what makes the quick check on a new server safe to run before you have decided anything at all.

## Assess and recommend

The raw facts are interpreted into plain language: findings about what is in place, what is missing, and how much each gap matters. This is where a recommendation like turning on the firewall or applying pending updates comes from.

Assessment reads what SlideOps actually observed on the machine, not a record of what SlideOps did to it. A measure you applied yourself, by hand, before you ever connected the server counts. A server somebody already hardened should not be told to start from nothing.

## Plan

The plan is the whole proposal, in the open, before anything runs.

It contains:

- **Every step, in order**, each with a title, a description, its own risk level, and what it will change.
- **The risks**, gathered and stated plainly rather than buried in the steps.
- **The rollback**: in words, what would be done to undo this if it goes wrong.
- **The verification strategy**: how the result will be proved, stated before it is proved.

The plan is read-only. Nothing about reading it starts anything.

Planning is also where SlideOps chooses the **Provider**: the implementation that knows how to reach this outcome on this particular machine. You do not pick it, and you do not need to know which one was picked. If no Provider supports this Capability on this Node, the Operation is refused at this point, before it exists as something you could approve.

Discovery, assessment, and planning all run as part of creating the Operation, so by the time the screen opens the Operation is already sitting at `awaiting_approval` with its plan attached. On a fast connection you will rarely see the intermediate states go past.

### What if a prerequisite is missing

Some Capabilities build on others. If a prerequisite has not completed on that Node, one of two things happens:

- For a hard dependency, the Operation is refused before it is created, naming what to do first.
- For a softer one, the plan is still built and the gap is added to the plan's risks, so you can decide with the information in front of you.

## Approve

**Approval is a real gate, and it is yours.**

Nothing executes before you approve. The approval is recorded with its timestamp. What you approved is exactly what runs: the plan does not change between approval and execution.

This is the point of the whole design. Infrastructure tools that act first and explain afterwards are fine right up until the moment they are not, and by then the change is on the machine. Putting a human decision between the proposal and the change is the difference between a tool you can run against production and one you cannot.

Approving enqueues the Operation. If executions are paused platform wide, or the account is suspended, the Operation stays queued at `approved` and says so, rather than failing or silently disappearing. It runs when the hold lifts.

A Viewer cannot approve. A role above Viewer is required.

### The exceptions, stated plainly

Three things do not pass through this gate, and it is better to know which.

**A question is not a change.** Reading which databases exist, listing containers, browsing a bucket: these run immediately, change nothing, and produce no Operation. A question that has to be approved is a question nobody asks. Anything that would change something goes through the full lifecycle regardless of which screen started it, and that is enforced in the domain rather than left to whoever wrote the screen.

**An Automation carries your standing approval.** Setting up an Automation is you approving those runs in advance, so each scheduled Operation is auto-approved. Nothing else is skipped: it still plans, still executes, still verifies, and still lands in History. The Automations list shows how the last run went, not only when the next one is due.

**A few internal provisioning flows auto-approve their own sub-Operations**, where the thing you approved already implies them: approving a Compose stack plan authorises the Capability installs it described, and the same applies to domain routing and private network enrolment. In every case the approval you gave is what authorises them, and every one of them appears in History as its own Operation.

Starting, stopping, and restarting an installed engine is also a direct control rather than a planned change, for the same reason a light switch does not need a work order.

## Execute

Execution streams live.

Each step runs in order, and its output appears in a terminal as it happens, while a timeline beside it shows where the Operation has got to in the plan. Both are driven by the same event stream, so they cannot disagree.

Before making a change, where the Capability's plan includes a backup step, SlideOps takes that backup first. Securing SSH, for instance, copies `sshd_config` to a timestamped file next to it before touching anything, and that copy is what the rollback restores. Not every change can be backed up this way, and the plan says so: a step that deletes a data directory tells you in its risks that it cannot be undone.

Commands run with standard input closed, deliberately. A packaging tool that stops to ask an interactive question fails immediately with a readable error instead of hanging until a timeout.

An Operation that has not finished within forty five minutes is stopped rather than left running indefinitely, and the record says so along with the last thing it reported.

### Cancelling

Cancellation is cooperative and checked between steps.

Cancel before execution and the Operation is marked cancelled at once; nothing ran. Cancel while it is executing and the request is registered, the current step is allowed to finish, and the Operation stops at the next step boundary. A step is not killed halfway through, because a half-executed step is exactly the state nobody can reason about.

When a cancel interrupts a step so that execution ends in an error, the plan's rollback is attempted before the Operation is marked cancelled. Read the event log to see how far it got: that is the record of what was actually done before it stopped.

## Verify

**Verification always follows execution. An execution without verification is incomplete.**

SlideOps proves the outcome rather than assuming it. Each check has a name, a pass or fail, and its evidence: the value actually read back from the machine, not a restatement of what was intended.

For example, after hardening SSH the checks read the effective configuration and report `PermitRootLogin is no` with the evidence `effective value is "no"`, or, on a failure, `expected "no" but effective value is "yes"`.

### The check every Operation gets

Regardless of the Capability, one check is always appended: **a fresh connection still authenticates**.

After the change, SlideOps opens a brand new SSH connection to the Node, from scratch, and confirms it works. It reloads the Node's record first, so a host key learned during this Operation is honoured.

This is the check that makes hardening SSH something you can actually run. A change that would cut off your access is caught while there is still a working connection to undo it with, rather than the next time you try to sign in.

### If verification does not pass

The plan's rollback runs automatically, and the Operation is recorded as `failed` with the reason `verification failed`.

There is no partial success. An Operation does not complete with a note that verification was inconclusive; either it passed and the Operation completed, or it did not and the change was undone.

## Rollback

Rollback is triggered by four things, all of them failures:

- Execution returned an error.
- Verification did not pass.
- A credential the Operation generated could not be sealed safely.
- A cancellation landed mid-execution.

What it restores is defined by the Capability's Provider, and it is a whole-plan undo rather than a per-step compensation. For a configuration file it means putting the most recent backup back and reloading the service. For a change that only created something, it means removing it again.

Rollback gets its own fresh time budget, so it still runs even when the execution it is undoing was cancelled or timed out. If it does not complete cleanly, the record says that too, rather than claiming an undo that did not happen.

One case where no rollback runs: an Operation interrupted by the API restarting. The process that would have performed the rollback is gone. Those Operations are marked failed on the next start, with the reason recorded as an interruption, and the screen does not claim they were rolled back.

## Observe and record

Every Operation is recorded in History with its plan, its parameters, its full live output, its verification result and evidence, and its outcome.

Events are numbered in sequence and stored as they are published, so replay and live subscription are the same stream. Opening a past Operation shows exactly what happened; opening a running one joins it where it is. There is no seam between the two, and no separate "live" view that later disappears.

Results also arrive as notifications the moment they land, so an Operation you started and walked away from tells you how it went.

Secrets never enter the record. A secret parameter is stored as the marker `[stored securely]`, and the plaintext lives only in the secret store, revealed in memory to the execution that needs it and never written to a log or returned by the API.

Deleting a History entry removes SlideOps' record of a run. It does not touch your infrastructure, and it does not undo anything: deleting the receipt does not undo the purchase.

## What you see, stage by stage

| Status | What is on screen |
| --- | --- |
| `created`, `discovering`, `assessing`, `planning` | "Preparing the plan: discovering, assessing, and planning." Usually a blink |
| `awaiting_approval` | The full plan, with Approve and run, and Cancel |
| `approved` | Queued. If a hold is in place, the reason |
| `executing` | Step timeline on the left, live terminal on the right, Cancel available |
| `verifying` | The same view, with checks arriving |
| `completed` | "The Operation completed and its result was verified", plus the verification evidence and any credentials it produced |
| `failed` | The error, and whether a rollback actually ran |
| `cancelled` | "This Operation was cancelled. Nothing further will run." |

A failed Operation offers Retry, which takes you back to the Capability with the same Node and Project already selected, so the next attempt starts from evidence rather than from guesswork.

## Why it is built this way

Three rules, and each one exists because the alternative fails in a specific way.

**Discovery only observes**, so that looking at a server is never a risk. If reading could change something, nobody would run the quick check on a machine that matters, and every plan afterwards would be built from a guess.

**Approval precedes execution**, so that surprise is impossible. The plan is not a preview of something already in motion; it is a proposal that expires unapproved.

**Verification follows execution**, so that "it ran" and "it worked" are never confused. Exit code zero is not evidence. Reading the value back is.

## Where to go next

- [Core concepts](/docs/start/core-concepts) for the vocabulary this page uses.
- [Troubleshooting](/docs/reference/troubleshooting) for what to do when an Operation fails.
