# Logs

Output in SlideOps comes from several distinct places, and each behaves differently. This page explains where each kind of output comes from, which of them stream live, and what you can do with them.

## The kinds of output

There are three surfaces worth knowing, plus the terminal.

| Surface | Where | What it is |
|---------|-------|------------|
| Service output | A Service's **Logs** tab, **Output** | The running workload's own stdout and stderr, streamed live |
| Service activity | A Service's **Logs** tab, **Activity** | The record of what was done to the Service, fetched on demand |
| Operation output | An Operation's detail page, **Live output** | The command output of one Operation as it runs |

A **Server has no log view of its own.** There is no logs tab on a Node. If you need a machine's system journal, open the Server's terminal and read it there with the tools already on the machine. See [Terminal](/docs/infrastructure/terminal).

That is a deliberate boundary rather than a gap. A Service's logs belong to that Service, and adopting a container that was already running does not move its logs anywhere: they stay on the Service page for that workload.

## A Service's own output

The **Output** view is the live stdout and stderr of the running workload, read from the Server over the SSH connection SlideOps already holds. There is no agent on the machine and no log shipper.

### What it streams

SlideOps runs the right follow command for how the Service actually runs: `docker compose logs --follow` for a Compose stack, `docker logs --follow` for a single container, `journalctl --follow` for a systemd unit. Timestamps come from those commands, so they are part of the text rather than something SlideOps adds.

When you open the view, the last 200 lines arrive first as history, and then new lines arrive as the workload produces them. On a reconnect, no history is re-sent, so lines are never duplicated.

The browser keeps up to 5000 lines. Past that, the oldest are dropped.

### Following, and jumping back

There is no follow toggle. The view stays pinned to the newest line while you are near the bottom. Scroll up and it stops moving, so you can read something without fighting the stream.

While you are scrolled up and new output is arriving, a footer button appears:

> New output is arriving below. Jump to latest.

Press it to return to the bottom and resume following.

### The controls

- **Wrap** toggles line wrapping. It is on by default. Turning it off gives long lines a horizontal scrollbar instead of folding them.
- **Copy** copies everything currently in the buffer, log lines and status notes together, in order. If the clipboard is unavailable the button changes to **Select it instead**.
- **Reconnect** opens a fresh connection. It does not clear what is on screen, and it turns following back on.
- The expand control fills the window with the log. `Esc` leaves full screen.
- The panel can be dragged taller by its bottom edge.

There is no pause, no clear, no download, no search, no line-count selector, and no timestamp toggle. Nothing is allowed to clear the buffer on its own; it resets only when you switch to a different Service.

### Reading the connection state

A small dot and word beside the toolbar report the state of the stream:

| Word | Meaning |
|------|---------|
| Connecting | Opening the stream |
| Connected | Streaming |
| Reconnecting | The connection dropped and is being re-established |
| Service stopped | The workload is not running; SlideOps is watching for it to start |
| Disconnected | The stream failed and is being retried |
| Stream ended | The stream closed cleanly |

Reconnection is automatic on both sides. If SSH drops, if the container is replaced by a deploy, or if the container exits and restarts, SlideOps reattaches and says so inline, in dimmed italic text in the same scroll view:

```text
SSH disconnected.
SSH reconnected.
Container exited (code 1).
Waiting for replacement…
Connected to replacement container.
Service is currently stopped.
Waiting for it to start…
```

These notes are part of the record, not a separate panel. When you come back to a log that has been running all night, the reason for a gap is sitting in the gap.

A failure that cannot be retried is shown as an alert above the panel instead, in the platform's own words: for example "This service has no container yet; its deploy did not create one."

### Colour

ANSI colour in your application's output is rendered. Bold, dim, italic, and underline are honoured, and the eight standard foreground colours plus their bright variants are mapped onto the interface's own palette, so red stays legible in both light and dark themes. Cursor movement and screen-clearing sequences are stripped rather than printed, which is why a progress bar that repaints itself in a terminal shows up here as successive lines.

Compose stacks are asked for output without colour, since a stack's own prefixing is easier to read plain.

### What is not filtered

SlideOps does not inspect or rewrite your application's log text. If your application prints a secret to its own output, that secret appears in this view exactly as printed.

SlideOps itself never writes secrets to a log: request logging carries method, path, status, and duration and never bodies or headers, and a sealed value reads as `[stored securely]` wherever it is stored or returned. But what your workload chooses to print is your workload's decision, and nothing here scrubs it.

## A Service's activity

The **Activity** view answers a different question from the output, which is why it sits beside it rather than somewhere else.

It records what was done to the Service: what deployed and from which commit, what started and stopped it, what changed its configuration, when a shell was opened in it, and every deploy that failed with the reason.

It is fetched once when you open it, newest first, with a **Refresh** button and a **Copy** control. It carries the most recent 100 entries.

A configuration change lists the environment variables that moved **by name only**. The values are not redacted, they are not read at all. That is what makes this record safe to show on the Service page rather than behind another permission.

The two views work together. The output tells you the application is unhappy. The activity tells you somebody changed three environment variables nine minutes before it became unhappy, which is the part you cannot get from the output at any length.

This is not [Activity](/docs/observe/activity) in the sidebar sense. That records Operations, which act on a Server through the full lifecycle. Most of what happens to an application is not an Operation at all.

## An Operation's output

An Operation's detail page carries a **Live output** terminal showing the raw output from the Server as each plan step runs.

### Replay, then live

Opening an Operation loads its stored events first, then subscribes to the live stream. Both feed the same view and are merged by sequence number, which is assigned by the server and increases within one Operation.

The practical effect is that there is one screen, not two. An Operation halfway through shows everything that has already happened and then keeps going. An Operation from three months ago shows exactly what you would have seen at the time, replayed from the record.

### What is colour-coded

The output is a real terminal, so it renders ANSI faithfully. SlideOps colours its own event lines to make the structure readable: plan steps in cyan with a `>` prefix, status changes dimmed, verification results green or red, the completion line bold, and log lines coloured by level, red for errors and yellow for warnings.

It holds 5000 lines of scrollback and is read only: you cannot type into it.

### The controls

The expand control fills the window, `Esc` leaves it, and the panel can be dragged taller. There is no copy, download, wrap, or filter here.

A **Cancel** button sits in the section header while the Operation is running. That cancels the Operation, not the output. Cancellation is checked between steps.

The stream state is reported top right of the page as **Live**, **Reconnecting**, or **Stream closed**. A closed stream says nothing about whether the Operation is still running; the record is still there on reload.

## Deploy events

A Service's **CI/CD** tab carries its own trail of deploy events, fetched once, showing the fifty most recent. It answers what triggered each deploy and how it ended, which is a narrower question than the general activity trail.

## Who can read what

Reading output is a read. A **Viewer** can open a Service's output, its activity, a deploy trail, and any Operation's record, live or replayed.

Opening a terminal is not a read, even though the underlying request looks like one. A Viewer who tries gets the refusal written into the terminal itself:

> Your role in this workspace is read only, and a terminal is not.

That check runs before SlideOps dials the Server, so a refused terminal connects to nothing.

See [Roles and permissions](/docs/account/roles-and-permissions).

## Related

- [Activity](/docs/observe/activity) for the Operation record behind the output
- [Terminal](/docs/infrastructure/terminal) for reading a Server's own journal
- [Reports](/docs/observe/reports) for the summarised view
