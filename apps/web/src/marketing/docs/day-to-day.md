## Day to day

Getting a server secured and a Service running is the beginning. This is what the platform does for you once that is true.

### Know what a server still needs

A connected server is assessed against a baseline, and the result is shown on the server's own page: what is already done, what is missing, and how much each gap matters. It commends what is there rather than only listing what is not, because a server somebody already hardened by hand should not be told to start from nothing.

This runs against what SlideOps actually observed on the machine, not against a record of what SlideOps did. A measure you applied yourself before ever connecting the server counts.

### Adopt what is already running

If a server was doing real work before SlideOps saw it, that work is found and listed on the server page: containers, Compose stacks, NGINX sites, databases. You can bring any of it under management as it stands.

Adopting changes nothing on the server. The workload keeps running exactly as it was, and SlideOps starts holding a record of it so it appears in the Project alongside everything else. Nothing is rebuilt, restarted, or migrated.

### Open a terminal

Every server has a shell, and every running Service has its own. The Service shell puts you inside that Service and nowhere else; the server shell is the whole machine. Both are the real thing, a full interactive session over the same SSH connection SlideOps already holds, so there is no second credential to manage and no agent to install.

### Reach a Service

A deployed Service gets an address on the day it deploys, without you configuring DNS. Backends get a URL any frontend can call, and the ports they answer on are opened as part of the deploy rather than left as a step you find out about later. Where a Service serves a page, you can preview it from inside SlideOps over the connection you already have.

### Schedule the work you repeat

An Automation is a saved intent to run a Capability on a server on a schedule. Setting one up is your standing approval for those runs, so each scheduled Operation is auto-approved, but nothing else is skipped: it still runs the whole lifecycle, still verifies, and still lands in History.

The list tells you how the last run went, not only when the next one is due. An Automation that has started failing says so.

### Work with what you installed

A Capability's page becomes its management page once the thing is installed.
Databases list what they hold and what is connected to them, export a complete
copy streamed straight to you, and restore from a dump you upload.

Reading is immediate and changes nothing. Restoring is an Operation you approve,
with a copy of the current database taken first so it can be put back. On a
Service page all of it is scoped to that Service, so a database server shared by
several applications never shows one application another's data.

### Read what happened

History records every Operation, with its plan, its output, and the evidence from its verification. Reports pull that into five answers: what has been verified and on what evidence, what has been run and how often, the security posture of each server, an inventory of the fleet, and the health of one machine over time.

### Change your password

Security holds the account password and two step verification. Changing a password asks for the current one, because being signed in is not proof of identity on its own, and it signs out every other session for the account while keeping the one you are using.

### When something goes wrong

Verification failing is not a surprise state; it is part of the lifecycle. A failed verification rolls the change back. An Operation that cannot be completed is recorded as failed with its output intact, so the next attempt starts from evidence rather than from guesswork.
