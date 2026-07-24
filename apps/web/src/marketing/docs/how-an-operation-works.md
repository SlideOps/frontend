## How an Operation works

An Operation is one run of a Capability against a Node, from plan to verification. It follows the same lifecycle every time, so there are no surprises. This is what happens between the moment you start one and the moment it is recorded.

### Discover

The Operation begins by reading the Node again, so the plan is built from the Node as it is right now, not from a stale picture. Discovery is always read-only.

### Assess and recommend

SlideOps interprets the Facts into plain-language findings and decides what applies. This is where a recommendation like turning on a firewall or applying pending updates comes from.

### Plan

The plan is the whole proposal in the open. It lists every step in order, each with its own risk, the risks gathered plainly, the rollback that would undo the change, and the strategy that will verify the result. The plan is read-only until you act on it.

### Approve

Approval is a real gate, held by you, the Operator who owns the Node. Nothing executes before you approve, and the approval is recorded. This is the point of no surprise: what you approved is exactly what runs.

### Execute

Execution streams live. Each step runs in order and its output appears in a terminal as it happens, while a timeline shows where the Operation is in the plan. Before making a change, SlideOps backs up what it will touch, so a rollback is always possible.

Cancellation is cooperative and checked between steps, so you can stop an Operation cleanly.

### Verify

Verification always follows execution. An execution without verification is incomplete. SlideOps proves the outcome: it re-reads the Node to confirm the change took effect, and for anything that touches access it opens a fresh connection to confirm you were not locked out. Each check carries its evidence.

If verification does not pass, the backup is restored automatically and the Operation is marked failed, so a bad change never stays in place.

### Record

Every Operation is recorded in History with its plan, its live output, and its verification result. You can open any past Operation to replay exactly what happened, and if it is still running, watch it live from where it is.

### Realtime throughout

The terminal output, the step timeline, and the results all arrive over a single live connection. The same events are stored and replayed, so opening an Operation later shows the same record, and results reach you through notifications the moment they land.
