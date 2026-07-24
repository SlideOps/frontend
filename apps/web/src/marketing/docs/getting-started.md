## Getting started

SlideOps helps you run your own Linux infrastructure with confidence. You connect a Node, SlideOps reads its state without changing anything, and from there you choose the outcomes you want. Every change is planned, approved by you, executed in the open, and verified.

This guide takes you from a fresh account to your first verified Operation.

### 1. Create your account

Sign up as an Operator with an email and a password. Your Workspace is yours alone: the Projects, Nodes, and Operations inside it belong to you and no one else. We recommend turning on two step verification from the Security screen once you are in.

### 2. Connect a Node

A Node is one Linux machine you reach over SSH. To connect one, you give SlideOps its address, the SSH username, and how to sign in: a private key or a password. A key is the stronger choice, and it lets SlideOps harden SSH later without locking you out.

Your credential is encrypted the moment it reaches the backend, is only ever decrypted at connection time, and is never written to logs or returned by the API.

### 3. Run Discovery

Discovery opens a read-only connection and reads the state of the Node: its operating system, the services it runs, the ports it listens on, and its SSH posture. It never changes a single setting. Everything that follows is planned from what Discovery finds.

Discovery also produces an Assessment: the same picture in plain language, with findings and recommendations, so you know what is worth doing next.

### 4. Choose a Capability

A Capability is an outcome, not a tool. You search for what you want to achieve, such as securing SSH or enabling HTTPS, rather than the technology behind it. Each Capability shows its risk up front, the platforms it supports, and how its result will be verified.

Some Capabilities need a few inputs, such as a domain or a path. Those appear as a short form, each field with its own guidance.

### 5. Review, approve, and watch

Starting an Operation does not change anything yet. First you see the plan: every step in order, the risks stated plainly, how the change would be rolled back, and how the result will be verified. Nothing runs until you approve.

Once you approve, execution streams live. You watch the output in a terminal and follow a step timeline as each step completes.

### 6. Read the verification

Every Operation ends by proving its result. SlideOps re-reads the Node and, where it matters, opens a fresh connection so a change that would cut you off is caught. Each check shows whether it passed and the evidence behind it. If verification fails, the change is rolled back automatically.

That is the whole loop: discover, assess, plan, approve, execute, verify, record. You stay in control at every step.
