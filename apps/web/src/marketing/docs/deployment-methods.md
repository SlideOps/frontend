## Ways to get something running

A Service is one deployed workload on one of a Project's servers. How it gets
there is two separate choices: **where the workload comes from**, and **how it
runs on the machine**. They combine, and the combination decides what SlideOps
can do for it afterwards.

### Where it comes from

**From a repository.** Point SlideOps at a Git repository and a branch. The first
deploy clones it, builds it, and runs it. Every redeploy pulls that branch, and
SlideOps notices when there are new commits waiting so a deploy is never a guess
about whether anything changed. Private repositories need GitHub connected, which
is what the `repo` scope is for.

This is the fullest option. SlideOps knows how the workload was built, so it can
rebuild it, roll it back, and tell you what changed.

**From an image.** Give SlideOps a container image that already exists, and it
runs it. Nothing is built. This suits anything published to a registry, and
anything whose build happens somewhere else.

**Adopted.** The workload was already running on the server when SlideOps found
it. Somebody deployed it by hand, or it predates SlideOps entirely, or it came
from another account.

Adopting changes nothing. The workload keeps running exactly as it was: not
restarted, not rebuilt, not moved. SlideOps starts holding a record of it so it
appears in the Project alongside everything else, with its status, its logs, its
terminal and its resource use. Because SlideOps did not build it, there is
nothing to rebuild it from, so an adopted Service cannot be redeployed from
source until you give it one.

This is how a server with years of history joins the platform without a
migration.

### How it runs

**A container.** One container, with hard limits on CPU, memory and processes.
The most common choice, and the one with the most management available.

**A Compose stack.** Several containers described by a Compose file in your
repository: an application, its database, its cache, whatever it declares.
SlideOps reads the file and runs the stack. Because a stack is described by a
file, this is only available from a repository; an image alone cannot describe
one.

**A systemd service.** No container at all. A command, run and supervised by the
machine itself, with resource limits enforced through cgroups. For workloads that
should not be containerised, and for servers where Docker is not wanted.

### What combines with what

|                       | Container | Compose stack            | systemd service |
| --------------------- | --------- | ------------------------ | --------------- |
| **From a repository** | Yes       | Yes                      | Yes             |
| **From an image**     | Yes       | No, a stack needs a file | Not applicable  |
| **Adopted**           | Yes       | Yes                      | Yes             |

A Compose stack always comes from a repository, because the stack is the file. A
systemd service always needs an explicit command, because there is no image
entrypoint to fall back on.

### Why the choice matters afterwards

The method decides how much SlideOps can do for the workload later.

- **From a repository** is the only one where SlideOps can rebuild from source,
  so it is the only one where a redeploy means "take the newest code".
- **From an image** can be moved to a new image tag, but SlideOps cannot tell you
  what changed inside it.
- **Adopted** is fully managed for everything that reads the machine (status,
  logs, terminal, resource use, monitoring) and cannot be rebuilt until you
  attach a source.

All three are equal for the parts that matter day to day: every one of them gets
an address, a terminal, monitoring, and a place in History.
