# Reports

Reports turn what SlideOps already holds into a readable page you can print. This page explains the five report types, what each one answers, and what it is built from.

Reports live under **Observe**, at `/app/reports`.

## How reports work

A report is generated when you ask for it. Nothing is stored: each one is assembled on the spot from the Operations, Verifications, Discoveries, and metrics the platform already holds, scoped to your Workspace.

That means two things worth knowing up front.

A report is always current as of the moment you opened it. There is no build step, no schedule, and no stale copy to refresh.

And a report can only say what SlideOps has actually observed. A server nobody has run Discovery on has nothing to inventory and no security posture to report. The reports say so plainly rather than leaving a row of blanks that would read as a clean bill of health.

## Choosing a report

The screen has two controls.

**Report type** is a row of buttons: Operations, Verification, Inventory, Security, Health. There are five, and no others.

**Server** scopes the report. Most reports default to **All Nodes** and can be narrowed to one. Health is the exception: it is about one machine by definition, so the all-servers option is not offered, and if you have not chosen one it falls back to your first server.

The report regenerates as soon as you change either control.

## Printing

**Print** opens your browser's print dialogue with the report laid out for paper. The controls, the navigation, and any error notes are hidden; only the report itself prints, under a "SlideOps report" heading. Use your browser's save as PDF option if you want a file rather than paper.

This is what makes a report useful as a record: something you can attach to a ticket, hand to a client, or file after a change window.

## The five reports

### Operations

**What it answers:** what has been run in this Workspace, how often, and how it went.

Three sections:

- **Summary**, with the total number of Operations and a count per status, so a run of failures is visible immediately.
- **By Capability**, a table of every Capability and how many times it has been run, most run first. This is the one that tells you what you actually do with this platform, as opposed to what you think you do.
- **Recent**, the fifty most recent Operations with Capability, status, when they started, and when they finished.

The counts cover every Operation. Only the Recent table is capped, at fifty rows.

Scoped to one server, all three narrow to that server.

### Verification

**What it answers:** what has been proved, and on what evidence.

- **Summary** leads with the headline: how many Operations were verified, how many passed, and how many failed. When nothing failed it reads "Every one of 22 verifications passed."
- **Results** is a table, one row per verified Operation: the Capability, the outcome, how many checks passed, and when it completed.
- **Evidence** follows, one section per Operation, listing each individual check by name with its detail and whether it passed.

The evidence is the point. A verification report that only said "passed" would be an assertion, which is exactly the thing it exists to replace. Evidence sections are shown for the twenty most recent verified Operations.

Only Operations that carry a Verification appear. An Operation that failed before it reached verification is in the Operations report, not this one.

### Inventory

**What it answers:** what machines exist, and what each one is.

A single table: name, address, status, operating system with its version, and kernel.

Each row is the Node's own record enriched with its most recent Discovery, which is where the kernel, package manager, CPU core count, and total memory come from. A Node that has never been discovered still appears, with the fields Discovery would have filled left as "Not recorded".

This is the report to print when somebody asks what you are running, or when you need a fleet list that was not typed by hand.

### Security

**What it answers:** the SSH and firewall posture of each server.

A **Posture** table, one row per server: root login, whether password authentication is refused or allowed, whether a firewall is active and which backend it uses, and when the server was last read.

Password authentication is reported as the safe answer rather than the raw value, because "false" is not obviously the good outcome at a glance. Refused is what you want to see.

Below it, when it applies, a **Not yet read** section listing every server no Discovery has run against:

> Run Discovery on these before relying on this report. Nothing has been observed about them.

That section exists because the alternative is worse. A server with no observations would otherwise show as a row of blanks, and blanks read as nothing wrong here.

This report is built entirely from Discovery. It reflects what is true on the machine, not a record of what SlideOps did to it, so hardening you applied by hand before ever connecting the server counts.

### Health

**What it answers:** how one server is doing right now, and recently.

- The most recent reading: load average, memory used as a percentage, disk used as a percentage, the number of running services, uptime, and when the reading was taken.
- **Recent readings**, a table of the last twenty readings, newest first, with the same load, memory, disk, and service figures.

Health is the one report that needs a server chosen. It is about one machine, so it cannot be answered across all of them. If no servers are connected, the screen says so rather than showing an error:

> A health report is about one server, and none are connected yet. Connect a server and it will have something to report on.

## Which report answers which question

| You want to know | Report |
|------------------|--------|
| What have we changed on these servers, and did anything fail? | Operations |
| Can I prove that a change actually took effect? | Verification |
| What machines do we have, and what are they running? | Inventory |
| Is SSH locked down, and is the firewall on? | Security |
| Is this one machine healthy right now? | Health |

## Limits worth knowing

Reports read; they never change anything. Generating one cannot affect a server.

A report is scoped to your Workspace, and to one server when you narrow it. There is no cross-Workspace report.

There is no scheduled delivery, no email, and no export format other than printing. What the screen shows is what a report is.

## Related

- [Activity](/docs/observe/activity) for the underlying Operation records
- [Logs](/docs/observe/logs) for live output rather than summaries
- [Glossary](/docs/reference/glossary) for Discovery, Verification, and Node
