# Automations

An Automation is a saved intent to run one Capability on one Server on a recurring schedule. This page explains exactly what an Automation is today, what it can and cannot do, and how it relates to Operations.

Automations lives under **Automate**, at `/app/automations`.

## What an Automation is

Three things, saved together:

- a **Node**, the Server it runs on
- a **Capability**, and the inputs that Capability takes
- a **schedule**, a recurrence

That is all. An Automation is not a workflow: there are no steps, no branches, no conditions, no dependency between one Automation and another, and no reaction to an event. It runs one Capability, on one Server, when the clock says so.

Being clear about that is worth more than the alternative. What exists is small and predictable, and everything it produces goes through the same lifecycle as work you drive by hand.

## What it can trigger

An Automation runs a **Capability**, chosen from the same catalogue you would pick from by hand, with the same inputs that Capability declares.

There is nothing else it can trigger. It cannot run an arbitrary command, cannot deploy a Service, cannot call a webhook, and cannot send a notification of its own.

Nothing else triggers an Automation, either. There is no run-on-push, no run-when-a-check-fails, and no run-after-another-Automation. The only triggers are the schedule and the **Run now** button.

## Schedules

Four frequencies, deliberately coarse:

| Frequency | When it fires |
|-----------|---------------|
| Hourly | At the top of every hour. The time of day is ignored. |
| Daily | At the chosen time, every day |
| Weekly | At the chosen time, on the chosen day of the week |
| Monthly | At the chosen time, on the chosen day of the month |

There is no cron expression, no interval in minutes, and no time zone selector.

Two details matter in practice.

**Times are UTC.** The schedule stores a time of day in UTC. The next run time is shown to you in your own locale, so a daily schedule set for 02:00 will display in your local time and will not shift with your local daylight saving.

**Monthly is capped at day 28.** A monthly schedule accepts days 1 to 28, so every month can honour it. A run is never skipped because February was short.

The scheduler scans once a minute for Automations that are due, so a run starts within about a minute of its scheduled time.

## Creating one

**New Automation** asks for a Server, a Capability, that Capability's inputs, and a schedule. It is enabled on creation.

Any secret input is sealed as it is saved. The Automation record stores the marker `[stored securely]` in its place, and the plaintext is revealed from the secret store only at the moment a run needs it. It is never written back into the record and never returned by the API. See [Credentials](/docs/configure/credentials).

Automations are a paid feature. On the Free plan, creating one is refused with the plan's own message:

```text
the free tier does not include automations
```

Every plan above Free includes them. See [Billing](/docs/account/billing).

## How an Automation relates to Operations

Every run of an Automation creates a real **Operation**. Not a lighter-weight version of one: the same thing, in the same list, with the same record.

The one difference is approval.

Setting up an Automation is your standing approval for its runs. So the Operation a schedule produces is auto-approved rather than sitting at `awaiting_approval` waiting for a person who is asleep. The list says so at the top of the screen:

> Scheduled runs are auto-approved

Nothing else is skipped. A scheduled Operation still discovers, assesses, plans, executes, verifies, and records. It still rolls back on a failed verification. It still lands in [Activity](/docs/observe/activity) with its plan, its output, and its verification evidence, marked as automated and linked back to the Automation that produced it.

That is what makes an unattended run trustworthy. It ran the same way you would have run it, and you can read exactly what it did afterwards.

## Reading the list

Each row shows the Capability, the Server, the schedule in plain words, and, most importantly, **how the last run went**.

- Not run yet
- Last ran, with the time
- Last run failed, with the time, in red with a warning icon
- Running since, with the time

The next run time is shown too, on wider screens, or **Paused** when the Automation is disabled.

The last run status leads because of what an Automation is. It runs while nobody is watching. A list that showed only when the next run is due would make an Automation that had failed every night for a week look exactly like one that had worked every night, and the only way to find out would be to open the run.

## Managing one

From the list:

- The **Enabled** checkbox pauses and resumes it. A disabled Automation keeps its schedule but does not fire.
- **Run now** fires it immediately and takes you straight to the Operation it created. It is still auto-approved and still runs the full lifecycle, and it records the run and moves the next run time along exactly as a scheduled fire does.
- The trash control removes it, after a confirmation. Its past Operations stay in History.

The detail page adds:

- **What it does**, the saved inputs named the way the Capability names them, so you can see which username a scheduled account creation actually creates. Secret values read as their marker.
- **Last run** with its status badge, and **Open the last run** to go straight to that Operation.
- An editable schedule and enabled flag, with **Save changes**. Changing the schedule recomputes the next run time.

When the last run failed, the page says so and says what happens next:

> The last run of this Automation failed. It will try again at the next scheduled time. Open the run to see what went wrong.

## What stops an Automation from firing

A due Automation is skipped, rather than failing, in three cases:

- It is disabled.
- The account that owns it is suspended. Its next run time is left in the past deliberately, so it fires once the account is restored rather than silently missing the run.
- A platform-wide hold on scheduled work is engaged by whoever runs the platform. Held Automations keep their past due time, so each fires once after the hold lifts rather than once for every minute it was held.

A run that fails does not retry immediately. The next run time always moves forward after a fire, successful or not, so a broken Automation does not fire every minute.

## Roles

Creating, editing, enabling, running now, and deleting an Automation all need a role above Viewer. A Viewer sees the list, the schedules, and how the last runs went, without any of the controls. Trying to create one lands on:

> This needs a role above Viewer
>
> A Viewer can see this workspace's Automations but cannot create one.

See [Roles and permissions](/docs/account/roles-and-permissions).

## Related

- [Activity](/docs/observe/activity) for the Operations an Automation produces
- [Credentials](/docs/configure/credentials) for how secret inputs are held
- [Billing](/docs/account/billing) for which plans include Automations
