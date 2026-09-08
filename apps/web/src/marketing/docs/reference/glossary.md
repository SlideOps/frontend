# Glossary

Every term in the SlideOps vocabulary, defined in one or two sentences, alphabetically. One concept, one name, everywhere: in the app, in the API, and in these docs.

## A

**Activity trail**
A Service's own record of what happened to it: deploys, starts and stops, configuration changes, shells opened, and health changes. It is not History, which records Operations.

**Adopted**
A Service whose workload was already running on the server when SlideOps found it. It is fully managed for everything that reads the machine, but it can never be redeployed, because SlideOps did not build it.

**Approval**
The Operator's explicit agreement to a plan, required before any Operation executes. It is recorded with its timestamp, and what was approved is exactly what runs.

**Assessment**
The interpretation of Discovery's raw facts into plain-language findings and recommendations: what is in place, what is missing, and how much each gap matters.

**Automation**
A saved intent to run a Capability on a server on a schedule. Setting one up is your standing approval for those runs, so each scheduled Operation is auto-approved; nothing else about the lifecycle is skipped.

## C

**Capability**
A description of what the Operator wants, expressed as an outcome and never as a technology. "Secure SSH", "Enable containers", "Install PostgreSQL". Capabilities are reusable definitions; an Operation is one run of one.

**Capability Service**
A Service that is infrastructure rather than an application: several Capabilities, such as PostgreSQL and Redis, deployed together under one name. Each one runs as its own Operation.

**Compose stack**
A runtime where several containers described by a compose file in your repository are run together. Only available from a repository, because the stack is the file.

**Container**
A runtime where the Service is one Docker container with hard limits on CPU, memory, and processes. The recommended default.

**Core**
Capabilities available on every server with nothing to install. The Core bundle covers the machine itself: SSH, the firewall, network and database access, the application user, server accounts, packages, and monitoring. It cannot be uninstalled.

**Credential**
The private key or password SlideOps uses to reach a Node. It is encrypted the moment it arrives, decrypted only at connection time, and never logged or returned by the API.

## D

**Deploy hook**
A per-Service bearer token that lets an outside CI system trigger a deploy of that one Service. Shown once when rotated and never readable afterwards.

**Deployment**
One release of a Service: one act of taking a source and putting it on the machine. Deployments move forward; SlideOps keeps no previous releases to switch back to.

**Diagnose**
An on-demand check of a deployed Service against the things that break after a good deploy: a crash-looping container, an unreachable dependency, a hostname with nothing listening. It never changes the server.

**Discovery**
The read-only reading of a Node: its operating system, package manager, init system, what is installed, what is listening, and its SSH posture. Discovery only observes and never modifies.

## E

**Evidence**
The observed value a Verification check carries to justify its result, such as `effective value is "no"`. Evidence is what was read back, not a restatement of intent.

**Event**
One realtime message in an Operation's stream: a log line, a step boundary, a status change, a verification result, or completion. Events are numbered in sequence, stored, and replayed.

## F

**Facts**
The structured result of Discovery: what SlideOps observed on a Node. Providers are selected from Facts, and plans are built from them.

## H

**History**
The record of every Operation, with its plan, its output, its verification result and evidence, and its outcome. Deleting a History entry removes the record of a run; it does not undo it.

## M

**Marketplace**
The catalog of Plugins available to install into a Project.

## N

**Node**
One Linux machine reachable over SSH. The domain term for what the app's navigation calls a Server. A Node belongs to at most one Project at a time.

## O

**Operation**
One execution of a Capability against one Node, from plan to verification. An Operation carries its plan, its parameters, its events, its verification result, and its outcome.

**Operator**
The account that owns and acts on infrastructure. The word "user" is deliberately not used for this, because in an infrastructure context it is ambiguous with a Linux account on a server.

## P

**Plan**
The reviewable proposal an Operator approves before anything runs: every step in order with its own risk, the risks gathered plainly, the rollback that would undo the change, and the strategy that will verify the result.

**Plugin**
A bundle that adds Capabilities. A Plugin is installed into a Project, and installing it unlocks its Capabilities for that Project's Services.

**Preflight**
A read-only check run before a deploy that reports what a real deploy would run into: an unreachable server, a missing runtime tool, a port already taken, resources tighter than requested. It changes nothing and does not block the deploy.

**Project**
A grouping of a stack and the Services that run it, on the servers assigned to it. Not an environment: SlideOps has no built in dev, staging, and production.

**Provider**
The implementation that knows how to reach a Capability's outcome on a specific platform. One Capability, many Providers; selection is automatic and driven by Discovery. Never called a driver or an adapter.

## R

**Redeploy**
Re-running a Service's whole deploy: pull, rebuild, rerun. It applies a saved configuration change and takes the newest commit on the branch. Distinct from Restart, which only bounces the existing workload.

**Remove**
Stopping and tearing down a Service's workload while keeping its record. For an adopted Service it means releasing it from management, leaving the workload running.

**Risk level**
Low, medium, or high, carried by a Capability and by each step of a plan, so the cost of a change is visible before it is approved.

**Rollback**
The undoing of an Operation's change, defined by its Capability and stated in its plan before approval. It runs automatically on execution failure, verification failure, a failure to seal a generated credential, or a cancellation that ends execution in an error. It is not a way to return a Service to a previous release.

## S

**Sealed**
A value encrypted into the secret store and revealed only to the deploy that needs it. A sealed value reads back as `[stored securely]` and is genuinely unreadable afterwards.

**Server**
What the app's navigation calls a Node. The same thing, in the word an Operator uses for the machine in front of them.

**Service**
One deployed workload running on one Node inside one Project, under resource limits you set. Either a software Service, which is your application, or a Capability Service, which is infrastructure.

**Software Service**
A Service that is an application, API, frontend, or worker, deployed from a repository or an image. Distinguished from a Capability Service.

**Source**
Where a Service's workload comes from: a container image, a Git repository, adopted (already running), or capability (a Capability Service).

**Stack**
The Plugins installed into a Project, and the Capabilities they unlock there.

**Step**
One unit of a plan, with a title, a description, its own risk level, and what it changes. Execution runs steps in order, and cancellation is checked between them.

**systemd**
A runtime where the Service is a command run and supervised by the machine itself, with limits enforced through cgroups. No container is involved, and a command is required.

## T

**Tier**
The plan bounding how many Workspaces, servers, Projects, and team seats an account may have, and how far back History is retained. It never bounds CPU, memory, disk, or the number of Services on a server, because those are the Operator's own resources.

## V

**Verification**
The proof that an Operation did what it said, always run after execution and never skippable. It is a set of named checks, each with a pass or fail and its evidence. Never called a success check.

## W

**Workspace**
The tenancy everything lives inside: servers, Projects, Services, Operations, and History all belong to exactly one, and nothing crosses between them. Every account has a Personal Workspace, and members hold a role of Owner, Admin, Member, or Viewer. Never called a dashboard.

## The words we do not use

Because using them would blur a distinction that matters:

| Use this | Not this |
| --- | --- |
| Operator | User, in an infrastructure context |
| Node, or Server | Machine, Host |
| Capability | Feature, Tool, Action |
| Operation | Task, Job |
| Provider | Driver, Adapter |
| Verification | Success check |
| Workspace | Dashboard |
| Project | Environment |
