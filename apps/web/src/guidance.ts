import type { GuidanceRegistry } from '@slideops/tooltips';

/**
 * The application guidance content for every surface: marketing, the operator
 * area, and the admin control plane. Each control looks up its explanation here
 * by a stable key. Copy is written in the ubiquitous language and reviewed like
 * any other product text.
 */
export const guidance: GuidanceRegistry = {
  'dashboard.workspace': {
    label: 'Workspace',
    summary: 'Your Workspace gathers your Projects, Nodes, and recent Operations in one place.',
    detail:
      'A Workspace is the home for your work. From here you reach every Project you own, the Nodes inside them, and the Operations you have run recently. Nothing here belongs to anyone else.',
  },
  'dashboard.nodes': {
    label: 'Nodes',
    summary: 'A Node is one Linux machine you connect over SSH. Your Nodes stay yours.',
    detail:
      'A Node is a machine you own and reach over SSH. SlideOps reads its state during Discovery and never changes it without a plan you approve first.',
  },
  'dashboard.operations': {
    label: 'Operations',
    summary: 'An Operation is one run of a Capability against a Node, from plan to verification.',
  },
  'dashboard.recommendations': {
    label: 'Recommendations',
    summary: 'Suggested Capabilities based on what Discovery found, each with a reason.',
  },
  'dashboard.health': {
    label: 'Health at a glance',
    summary:
      'A quick read on your Workspace: how many Nodes you have and how your recent Operations went.',
  },
  'dashboard.projects': {
    label: 'Projects',
    summary: 'A Project groups related Nodes so your Workspace stays organized as it grows.',
  },
  'project.overview': {
    label: 'Project',
    summary:
      'The second level of the model: a Project runs a stack on one or more of your servers.',
    detail:
      'You connect and secure your servers at the server level, then create a Project, assign the servers it runs on, install only the Plugins it needs, connect a repository, and deploy its Services. A Project carries its own stack, so each one holds only what it uses.',
  },
  'project.create': {
    label: 'Create a Project',
    summary:
      'Name a new Project and, optionally, describe what it runs. You assign servers and install its stack next.',
  },
  'project.name': {
    label: 'Name',
    summary: 'A friendly name for this Project, such as online shop or staging.',
  },
  'project.description': {
    label: 'Description',
    summary: 'An optional note on what this Project runs and why it exists.',
  },
  'project.servers': {
    label: 'Servers',
    summary:
      'The servers assigned to this Project. A server is connected and secured at the server level first, then assigned here.',
    detail:
      'A Project runs its stack and Services on the servers assigned to it. Assign a server you already connected and secured; unassigning returns it to the server level without touching the server itself.',
  },
  'project.assign': {
    label: 'Assign a server',
    summary:
      'Add one of your servers to this Project. Only servers not already in a Project can be assigned.',
  },
  'project.stack': {
    label: 'Stack',
    summary:
      'The Plugins installed into this Project. Install only what this Project needs; each unlocks its Capabilities here.',
    detail:
      'This is the per-Project Marketplace. Installing, enabling, and uninstalling act on this Project, so it carries only the stack it uses. The Core security bundle is on every server and shows as built in, so it is never installed or removed here.',
  },
  'project.capabilities': {
    label: 'Capabilities available here',
    summary:
      "The Core security Capabilities plus the ones this Project's installed Plugins unlock. Start an Operation on one of its servers.",
    detail:
      'A Core Capability runs on any server. A Plugin Capability runs only inside a Project that installed its Plugin, so starting one here carries this Project as its context. Assign a server to the Project first, since a Capability always runs on a server.',
  },
  'project.github': {
    label: 'GitHub',
    summary:
      'Connect GitHub so a Service with a repository source can clone on first deploy and pull on redeploys.',
    detail:
      'Connecting GitHub needs an OAuth app the platform registered. Once it is configured, connect your account to let deploys pull from your repositories. The access token is stored encrypted and never shown.',
  },
  'project.services': {
    label: 'Services',
    summary:
      'The Services deployed in this Project, each on one of its servers under hard resource limits.',
  },
  'project.routing': {
    label: 'Routing',
    summary:
      'The domain requests reach this Project by, and the host ports its Services occupy on each server.',
    detail:
      "Give this Project a domain, then point that domain's DNS at this Project's server: an A record to the server address, and an AAAA record too if you use IPv6. Once DNS resolves, set up a reverse proxy to serve the domain and send its requests to one of this Project's Services. The host ports listed here show which Project reaches which service on a shared server, so two Projects never collide on the same port.",
  },
  'node.name': {
    label: 'Name',
    summary: 'A friendly name you will recognize, such as web-1 or staging database.',
  },
  'node.hostname': {
    label: 'Hostname (optional)',
    summary:
      'Just a label for your reference, not how SlideOps connects. Put the machine name, reuse the address, or leave it blank. Address is the field that must reach the server.',
  },
  'node.address': {
    label: 'Address',
    summary: 'Where SlideOps reaches the Node over the network: a domain name or an IP address.',
  },
  'node.port': {
    label: 'SSH port',
    summary: 'The port the SSH service listens on. The default is 22.',
  },
  'node.username': {
    label: 'SSH username',
    summary: 'The account SlideOps signs in as over SSH, such as root or deploy.',
  },
  'node.project': {
    label: 'Project',
    summary: 'Optionally place this Node in a Project to keep related Nodes together.',
  },
  'node.authKind': {
    label: 'How to sign in',
    summary: 'Choose a private key or a password for the SSH connection. A key is stronger.',
    detail:
      'A private key is the safer choice and lets SlideOps turn off password sign in during hardening without locking you out. If you sign in with a password, SlideOps keeps password sign in on and recommends moving to a key.',
  },
  'node.secret': {
    label: 'Credential',
    summary: 'Your password or private key. It is stored encrypted and never shown again.',
    detail:
      'The credential is encrypted the moment it reaches the backend and is only ever decrypted at connection time. It is never written to logs and never returned by the API, so once you save it you will not see it here again.',
  },
  'node.discover': {
    label: 'Discover',
    summary:
      'Connect read-only and gather the Facts about this Node. Discovery never changes anything.',
    detail:
      'Discovery opens a read-only SSH connection and reads the state of the Node: its operating system, services, listening ports, and SSH posture. It never changes a single setting. Everything that follows is planned from what Discovery finds.',
  },
  'node.facts': {
    label: 'Facts',
    summary: 'What Discovery read from the Node: its system, services, and SSH configuration.',
  },
  'node.assessment': {
    label: 'Assessment',
    summary: 'Discovery read in plain language, with the findings and what SlideOps recommends.',
  },
  'node.capabilities': {
    label: 'Available Capabilities',
    summary: 'The Capabilities that apply to this Node. Start one to plan an Operation.',
  },
  'node.health': {
    label: 'Health',
    summary:
      'A read-only look at this Node right now: CPU load, memory, disk, uptime, and services.',
    detail:
      'Health connects read only over SSH and reads the current metrics, and a recent history when the monitoring log is present. It never changes the Node. Enable the monitoring Capability to keep a history you can chart here.',
  },
  'node.health.history': {
    label: 'Recent history',
    summary: 'Memory, disk, and CPU load over the recent readings from the monitoring log.',
  },
  'server.posture': {
    label: 'Security posture',
    summary:
      'How this server is secured right now: the account SlideOps signs in as, how it signs in, and whether root can still sign in.',
    detail:
      'A secure server never lets SlideOps operate as root. This reads the connection account and, from the last quick check, whether root sign in is still permitted and whether password sign in is on. Anything the quick check has not read yet is shown as unknown rather than guessed.',
  },
  'server.secure': {
    label: 'Secure this server',
    summary:
      'A guided path to stop operating as root: create a non-root administrator, harden SSH, then switch SlideOps to the new account.',
    detail:
      'SlideOps should never operate a server as root once it is connected. This checklist walks you through it in order: run the quick check, create a non-root administrator with full sudo, harden SSH so root can no longer sign in, then switch the stored credential to the new account. Each step is a normal Operation you review and approve, and the final switch verifies the new account can sign in before it changes anything.',
  },
  'server.secure.discover': {
    label: 'Run the quick check',
    summary:
      'Read the server over SSH first, so the steps that follow are planned from what is really there. It changes nothing.',
  },
  'server.secure.admin': {
    label: 'Create a non-root administrator',
    summary:
      'Create a dedicated account with full sudo so SlideOps never has to sign in as root. This opens an Operation you approve.',
    detail:
      'This launches the Create Application User Capability with full sudo. Give the account a username and a public key you hold. When you start it, the Operation opens at its plan for you to review and approve before anything runs.',
  },
  'server.secure.hardenSsh': {
    label: 'Harden SSH',
    summary:
      'Turn off direct root sign in over SSH, so the only way in is the non-root account you created. This opens an Operation you approve.',
    detail:
      'This launches the Secure SSH Capability, which sets PermitRootLogin to no among other hardening. Do this only after the non-root administrator exists and works, so you are never left without a way in. The Operation opens at its plan for you to review and approve.',
  },
  'server.secure.rotate': {
    label: 'Switch to the new account',
    summary:
      'Point SlideOps at the non-root account. The new credential is verified before the switch, so a wrong one changes nothing.',
    detail:
      'Once the non-root administrator exists and SSH is hardened, switch the stored connection credential to that account. SlideOps signs in with the new credential first and only switches if that succeeds, so a mistake here can never lock you out. From then on every Operation runs as the non-root account, never as root.',
  },
  'server.settings': {
    label: 'Server settings',
    summary:
      'Manage ongoing access to this server: rotate the connection credential and manage the accounts on it.',
  },
  'server.credential': {
    label: 'Connection credential',
    summary:
      'Change the account or secret SlideOps signs in with. The new credential is verified before the switch, so you are never locked out.',
    detail:
      'This rotates the stored credential SlideOps uses to reach the server. You can move the connection to a different account at the same time. SlideOps signs in with the new credential before it switches, so if the new credential cannot sign in nothing changes and the old one keeps working.',
  },
  'server.credential.username': {
    label: 'Connection username',
    summary:
      'Leave this to keep the current account, or set a different account for SlideOps to sign in as.',
  },
  'server.credential.authKind': {
    label: 'How to sign in',
    summary: 'Whether the new credential is a private key or a password. A key is stronger.',
  },
  'server.credential.secret': {
    label: 'New credential',
    summary:
      'The new password or private key. It is stored encrypted the moment it arrives and never shown again.',
  },
  'server.users': {
    label: 'Server accounts',
    summary:
      'The accounts on this server and their access level. The account SlideOps connects with is protected and cannot be removed.',
    detail:
      'This reads the accounts on the server: full administrators, limited accounts with no sudo, and the built-in system accounts. The account SlideOps signs in with is marked and cannot be removed, so managing accounts never locks you out.',
  },
  'server.users.create': {
    label: 'Create or update an account',
    summary:
      'Add an account or reset its password, choosing whether it is a full administrator or a limited account. This opens an Operation you approve.',
    detail:
      'Give the account a username and, when you want to set or reset it, a password. Choose a full administrator with sudo, or a limited account with no sudo. This launches the manage-server-user Operation, which opens at its plan for you to review and approve.',
  },
  'server.users.remove': {
    label: 'Remove an account',
    summary:
      'Remove an account from the server. The connection account, root, and system accounts are protected and cannot be removed.',
  },
  'reports.overview': {
    label: 'Reports',
    summary:
      'Generate a readable report from your Operations, verifications, discoveries, and metrics.',
    detail:
      'A report is generated on read from what SlideOps already holds. Pick a type, scope it to a Node if you like, and print it when you need a record. Nothing is changed to produce a report.',
  },
  'reports.scope': {
    label: 'Scope',
    summary: 'Limit the report to a single Node, or leave it across all your Nodes.',
  },
  'capability.search': {
    label: 'Search by outcome',
    summary: 'Search for what you want to achieve, not the technology behind it.',
  },
  'capability.core': {
    label: 'Core and Plugin Capabilities',
    summary:
      'These are the Core security Capabilities, on every server. A Project unlocks more once its Plugin is installed.',
    detail:
      'The Core security bundle is available on every Node with no Project: secure SSH, configure the firewall, create an application user, and manage packages and updates. Every other Capability comes from a Plugin and becomes available inside a Project once that Project installs the Plugin from the Marketplace.',
  },
  'capability.risk': {
    label: 'Risk',
    summary:
      'How much a Capability changes on the Node. You always review a plan before anything runs.',
  },
  'capability.category': {
    label: 'Category',
    summary: 'The area of work a Capability belongs to, such as security or networking.',
  },
  'capability.outcome': {
    label: 'Outcome',
    summary:
      'What this Capability achieves on a Node, stated as a result rather than a set of commands.',
  },
  'capability.intent': {
    label: 'Intent',
    summary:
      'Why this Capability exists and the goal it serves, so you choose it for the right reason.',
  },
  'capability.platforms': {
    label: 'Supported platforms',
    summary: 'The Linux families this Capability runs on. It adapts to the one your Node uses.',
    detail:
      'A Capability is written once and runs across the common distributions through a shared platform layer. It detects your Node family from Discovery and uses the right package manager, service manager, and backend for it.',
  },
  'capability.verification': {
    label: 'How verification proves it',
    summary:
      'The way SlideOps confirms the outcome really happened before calling the Operation done.',
    detail:
      'Every Operation ends by proving its result: SlideOps re-reads the Node and, where it matters, opens a fresh connection so a change that would lock you out is caught. The evidence is shown with each check.',
  },
  'capability.start': {
    label: 'Start an Operation',
    summary:
      'Choose a Node, fill in any inputs, and open the plan. Nothing runs until you approve it.',
    detail:
      'Some Capabilities need a few inputs, such as a domain or a path. Those are shown as a form here, each field with its own guidance and validation. When you start, the Operation opens at its plan for you to review and approve.',
  },
  'parameters.form': {
    label: 'Inputs',
    summary: 'The details this Capability needs to run, each validated as you type.',
  },
  'operation.plan': {
    label: 'Plan',
    summary: 'The exact steps SlideOps proposes. Nothing runs until you approve it.',
    detail:
      'The plan is the whole proposal in the open: every step, the risks in plain language, how the change would be rolled back, and how the result will be verified. Read it, then approve when you are comfortable. Approval always comes before execution.',
  },
  'operation.steps': {
    label: 'Steps',
    summary: 'Each change the Operation will make, in order, with its own risk.',
  },
  'operation.risks': {
    label: 'Risks',
    summary: 'What could go wrong and what to watch for, stated plainly.',
  },
  'operation.rollback': {
    label: 'Rollback',
    summary: 'How the change is undone if verification does not pass.',
    detail:
      'Before making changes, SlideOps backs up what it will touch. If verification fails, it restores that backup automatically and marks the Operation failed, so a bad change does not stay in place.',
  },
  'operation.verificationStrategy': {
    label: 'How it is verified',
    summary: 'How SlideOps will confirm the change worked before calling the Operation done.',
  },
  'operation.approve': {
    label: 'Approve',
    summary: 'Approve the plan to start execution. This is the point of no surprise.',
  },
  'operation.cancel': {
    label: 'Cancel',
    summary: 'Stop the Operation. Cancellation is cooperative and is checked between steps.',
  },
  'operation.terminal': {
    label: 'Live output',
    summary: 'The raw output from the Node as each step runs, streamed as it happens.',
  },
  'operation.timeline': {
    label: 'Step timeline',
    summary: 'Where the Operation is in the plan. Each step advances as it completes.',
  },
  'operation.verification': {
    label: 'Verification',
    summary: 'The checks that confirm the change worked, each with its evidence.',
    detail:
      'Verification always follows execution. SlideOps re-reads the Node and opens a fresh connection to confirm both that the change took effect and that access was retained. Each check shows whether it passed and the evidence behind it.',
  },
  'login.email': {
    label: 'Email',
    summary: 'Sign in with the email you registered as an Operator.',
  },
  'login.password': {
    label: 'Password',
    summary: 'Your password is never stored in plain text and never appears in logs.',
  },
  'register.email': {
    label: 'Email',
    summary: 'This becomes your Operator sign in. Use an address you can always reach.',
  },
  'register.password': {
    label: 'Password',
    summary: 'Use at least 12 characters. Longer passphrases are stronger and easier to recall.',
    detail:
      'We ask for at least 12 characters because length is the best defense against guessing. A short phrase you can remember beats a short string you cannot. Your password is stored only as a salted hash, never in plain text.',
  },
  'register.confirm': {
    label: 'Confirm password',
    summary: 'Type the same password again so a typo cannot lock you out.',
  },
  'mfa.code': {
    label: 'Verification code',
    summary: 'The 6 digit code from your authenticator app. It changes every 30 seconds.',
    detail:
      'Two step verification asks for a short code in addition to your password, so a stolen password alone cannot reach your Workspace. The code comes from an authenticator app on your device and refreshes every 30 seconds.',
  },
  'security.mfa': {
    label: 'Two step verification',
    summary: 'A second step at sign in, on top of your password, using a code from an app.',
    detail:
      'Two step verification protects your Workspace even if your password is exposed. After the password, sign in also asks for a short code from an authenticator app that only you hold. We recommend keeping it on.',
  },
  'security.secret': {
    label: 'Setup secret',
    summary: 'Add this secret to your authenticator app to start generating codes.',
    detail:
      'Your authenticator app turns this secret into a rotating 6 digit code. Add it by typing the secret or scanning the setup URL, then confirm with the first code the app shows. Keep the secret private.',
  },
  'security.disable': {
    label: 'Confirm your password',
    summary: 'Confirming your password proves it is you before protection is removed.',
  },
  'notifications.center': {
    label: 'Notifications',
    summary:
      'A running list of your Operation results: what completed and whether verification passed.',
    detail:
      'As your Operations finish, their results appear here in real time over the same live connection that drives the terminal. Open one to jump straight to its full record. Nothing here leaves your Workspace.',
  },
  'notifications.push': {
    label: 'Browser notifications',
    summary:
      'Let SlideOps notify you when an Operation completes, even when this tab is in the background.',
    detail:
      'Turn this on to receive a notification from your browser the moment an Operation completes or its verification result is in, so you do not have to watch the screen. Your browser asks for permission first, and you can turn it off at any time.',
  },
  'automation.approval': {
    label: 'Scheduled runs are auto-approved',
    summary:
      'Setting up an Automation is your standing approval for its runs, so scheduled Operations run without a fresh approval.',
    detail:
      'An Automation is a saved intent to run a Capability on a Node on a schedule. Creating it is your approval for those runs, so each scheduled Operation is auto-approved. It still runs the full lifecycle of discover, assess, plan, execute, and verify, always lands in History, and always respects emergency pause and Operator suspend.',
  },
  'automation.schedule': {
    label: 'Schedule',
    summary:
      'How often this Automation runs. Times are in UTC so a run never shifts with your clock.',
    detail:
      'Choose hourly, daily, weekly, or monthly, and the time or day the run needs. SlideOps computes the next run from this and shows it back to you in plain language.',
  },
  'automation.enabled': {
    label: 'Enabled',
    summary: 'Turn an Automation off to pause its scheduled runs without deleting it.',
  },
  'marketplace.overview': {
    label: 'Marketplace',
    summary:
      'Browse first-party Plugins here, then install the ones a Project needs from inside that Project.',
    detail:
      'A Plugin is a first-party bundle of Capabilities and Providers behind one manifest. The Core security bundle is pre-installed on every server; every other Plugin is installed per Project, so a Project carries only the stack it needs. This catalog is for browsing; open a Project to install a Plugin there. Everything a Plugin adds runs inside the same discover, plan, approve, execute, and verify loop as the rest of SlideOps.',
  },
  'marketplace.perProject': {
    label: 'Installed per Project',
    summary:
      'Plugins install into a Project, not globally. Open a Project to install and configure the ones it needs.',
    detail:
      'Only the Core security bundle is pre-installed and always available. Every other Plugin is installed per Project, so each Project carries only the stack it uses. This catalog stays global for browsing; the install, configure, enable, and uninstall actions live inside a Project.',
  },
  'marketplace.search': {
    label: 'Search by outcome',
    summary:
      'Search for the outcome you want, such as a database or a runtime, not the technology.',
  },
  'marketplace.manifest': {
    label: 'What it does',
    summary:
      'The Plugin manifest in plain language: what it delivers and the version you would install.',
  },
  'marketplace.provides': {
    label: 'Capabilities it adds',
    summary:
      'The Capabilities this Plugin unlocks. Once it is installed and enabled, each one runs like any other.',
  },
  'marketplace.permissions': {
    label: 'Permissions',
    summary:
      'What this Plugin is allowed to do on your Nodes, stated plainly before you install it.',
  },
  'marketplace.install': {
    label: 'Install',
    summary:
      'Plugins install into a Project. Open the Project you want, then install and configure it there.',
    detail:
      'Installing is per Project: a Plugin unlocks its Capabilities inside the Project it is installed in. When a Plugin needs configuration, the form is generated from its manifest, each field validated the same way a Capability input is. Secret values are stored encrypted and redacted afterward.',
  },
  'marketplace.reconfigure': {
    label: 'Reconfigure',
    summary:
      'Change this Plugin configuration. Secret values are redacted, so re-enter them to change them.',
  },
  'marketplace.enabled': {
    label: 'Enable or disable',
    summary:
      'Disable a Plugin to hold back its Capabilities without uninstalling it. Enable it to bring them back.',
  },
  'capability.source': {
    label: 'Source',
    summary:
      'Where this Capability comes from: the pre-installed Core bundle, or the Plugin that added it.',
  },
  'capability.matrix': {
    label: 'Capability matrix',
    summary:
      'Which Capabilities apply to which platforms, generated from the Providers behind each one.',
    detail:
      'The matrix is generated from the Provider registry, not hand maintained, so it always reflects what will actually run. A check means a Capability is supported on that platform.',
  },

  'tier.panel': {
    label: 'Tier and usage',
    summary:
      'Your tier fixes how much you can run. Each meter shows what you are using against the limit.',
    detail:
      'Every Operator sits on a tier that sets hard ceilings on Nodes, Projects, Services, and the total vCPU and memory your Services may allocate. This panel reads your current usage against those ceilings so you can see your headroom. When a meter is close to full, remove something or ask an admin to raise your tier.',
  },
  'services.overview': {
    label: 'Services',
    summary:
      'A Service is one solution running on a Node under hard resource limits your tier allows.',
    detail:
      'A Service is a deployed solution: a container or a systemd unit running on one of your Nodes inside a Project, with hard CPU, memory, and process limits. Deploying is your explicit intent, so it is not routed through the Operation approval gate, but it still streams progress and always verifies the workload is actually running.',
  },
  'services.deploy': {
    label: 'Deploy a Service',
    summary:
      'Choose a Project and Node, a source, a runtime, and limits within your remaining quota.',
    detail:
      'A deploy runs one workload on a Node under the limits you set. The CPU and memory limits are constrained to what your tier leaves. SlideOps runs the workload with those limits applied and verifies it is up before marking it running.',
  },
  'services.quota': {
    label: 'Remaining quota',
    summary:
      'How much of your tier is still free for a new Service: Services left, vCPU, and memory.',
  },
  'service.name': {
    label: 'Name',
    summary: 'A short name for this Service, in lowercase letters, numbers, and hyphens.',
  },
  'service.project': {
    label: 'Project',
    summary: 'The Project this Service belongs to. Projects group related Nodes and Services.',
  },
  'service.node': {
    label: 'Node',
    summary: 'The Node this Service runs on. The workload and its limits are applied there.',
  },
  'service.runtime': {
    label: 'Runtime',
    summary: 'How the Service runs: a container in Docker, or a command as a systemd unit.',
    detail:
      'The container runtime runs the workload in Docker with the CPU, memory, and process limits applied, and is the default. The systemd runtime writes a unit that runs your command with the limits set through the cgroup. Container needs Docker on the Node.',
  },
  'service.source': {
    label: 'Source',
    summary:
      'Where the workload comes from: a prebuilt image, or a repository cloned and built first.',
  },
  'service.image': {
    label: 'Image',
    summary: 'The image to run, such as nginx:latest. It runs as is with your limits applied.',
  },
  'service.repository': {
    label: 'Repository',
    summary: 'The repository to clone and build before the workload runs.',
  },
  'service.branch': {
    label: 'Branch',
    summary: 'The branch to clone and pull on redeploys. Defaults to main.',
    detail:
      'A repository source is cloned on first deploy and pulled on redeploys with git pull on this branch, so there is no re-clone. Leave it as main unless the Service runs a different branch.',
  },
  'service.githubRepo': {
    label: 'From GitHub',
    summary:
      'Pick a repository from your connected GitHub account to fill the URL and branch for you.',
    detail:
      'When GitHub is connected, the repositories you can reach are listed here. Choosing one fills the repository URL and defaults the branch to that repository default branch. You can still edit both afterward.',
  },
  'service.command': {
    label: 'Command',
    summary:
      'The command the workload runs. A systemd Service needs one; a container may override its entrypoint.',
  },
  'service.cpu': {
    label: 'vCPU limit',
    summary:
      'The hard CPU ceiling, in vCPU, for example 0.5. It cannot exceed your remaining quota.',
  },
  'service.memory': {
    label: 'Memory limit',
    summary: 'The hard memory ceiling in MB. It cannot exceed your remaining quota.',
  },
  'service.pids': {
    label: 'Process limit',
    summary: 'An optional cap on how many processes the workload may run.',
  },
  'service.ports': {
    label: 'Ports',
    summary: 'Ports to publish, one per line, written host:container, for example 8080:80.',
  },
  'service.env': {
    label: 'Environment',
    summary:
      'Environment variables, one per line as KEY=value. Secret values are stored encrypted and redacted.',
  },
  'service.metrics': {
    label: 'Live usage',
    summary:
      'The current CPU and memory this Service is using against its limit, read live from the Node.',
  },
  'service.lifecycle': {
    label: 'Actions',
    summary:
      'Start, stop, or restart the running workload, or remove the Service and free its allocation.',
    detail:
      'These act on the running workload on the Node. Stop halts it without removing it; start brings a stopped Service back; restart cycles it. Remove stops and removes the workload and frees the vCPU and memory it held.',
  },
  'service.logs': {
    label: 'Logs',
    summary: 'The recent output from this Service, read from the Node. Refresh to pull the latest.',
  },
  'service.endpoint': {
    label: 'Reach it from anywhere',
    summary:
      'The base URL this Service answers on from outside the server, one per published port.',
    detail:
      'This is the address another program calls: a frontend, a mobile app, or a second Service. It is built from the Node address and each published host port, and the port was opened on the host firewall as part of the deploy, so it answers with no domain set up first. Two limits are worth knowing: a page served over HTTPS cannot call an http:// address, so a browser frontend on a secure origin needs the Configure HTTPS Capability and a domain in front of this; and a cross origin call has to be allowed by your own application, since SlideOps does not add CORS headers to what you deployed.',
  },
  'service.preview': {
    label: 'Preview',
    summary:
      'The live running Service, reached over the secure SSH tunnel so its port stays private.',
    detail:
      'This embeds the running app itself, proxied over the same SSH tunnel that reaches the Node, so nothing is exposed publicly. It appears once the Service is running and publishes a port. An app that relies on absolute asset paths may render imperfectly here; open it in a new tab for the full experience.',
  },

  // Admin control-plane guidance. Cross-tenant read for oversight only.
  'overview.health': {
    label: 'Platform health',
    summary:
      'A calm read on the platform: services, queues, and live Operations across all tenants.',
    detail:
      'The Admin surface reads across tenants for oversight only. It shows platform health, active Operations everywhere, and headline analytics, without ever acting on an Operator Node directly.',
  },
  'overview.operations': {
    label: 'Active Operations',
    summary: 'Operations running right now across every Operator, for oversight only.',
  },
  'overview.operators': {
    label: 'Operators',
    summary:
      'The Operators on the platform. Cross-tenant read is limited to oversight and support.',
  },
  'overview.nodes': {
    label: 'Nodes',
    summary: 'Every Node connected across all tenants, counted for oversight.',
  },
  'overview.active': {
    label: 'Active Operations',
    summary: 'Operations executing right now across every tenant.',
  },
  'overview.failures': {
    label: 'Failures in the last day',
    summary: 'Operations that failed in the last 24 hours, a quick read on platform trouble.',
  },
  'overview.suspended': {
    label: 'Suspended Operators',
    summary: 'Operators who cannot approve or execute Operations until they are unsuspended.',
    detail:
      'Suspending an Operator sets their account to suspended. While suspended, the approve endpoint refuses and the worker skips their queued Operations. Unsuspend restores normal behavior. Every change is audited.',
  },
  'operators.roster': {
    label: 'Operator roster',
    summary: 'Every Operator with their status, Node and Operation counts, and last activity.',
    detail:
      'The roster reads across tenants for oversight only. Open an Operator to see their recent Operations and to suspend or unsuspend them behind a confirmation. Nothing here acts on an Operator Node.',
  },
  'operators.tier': {
    label: 'Tier',
    summary:
      'Set the tier this Operator sits on, which fixes their Node, Project, Service, vCPU, and memory ceilings.',
    detail:
      'Each Operator sits on one of four tiers: free, starter, pro, or enterprise. The tier sets hard ceilings on how many Nodes, Projects, and Services they may run and the total vCPU and memory their Services may allocate. Changing it takes effect immediately and is written to the audit trail.',
  },
  'operations.record': {
    label: 'Operation record',
    summary: 'A read-only record of one Operation, read across tenants for oversight.',
    detail:
      'The control plane observes Operations, it does not act on them. This record shows the Operator, the Node, the Capability, and the status, without any approve, cancel, or run action.',
  },
  'operations.filter': {
    label: 'Filters',
    summary: 'Narrow the cross-tenant list by status or by a single Operator.',
  },
  'analytics.over_time': {
    label: 'Operations over time',
    summary: 'How many Operations ran per day across the platform.',
  },
  'analytics.status': {
    label: 'Status breakdown',
    summary: 'The share of Operations in each status, a read on outcomes at a glance.',
  },
  'analytics.capabilities': {
    label: 'Capability usage',
    summary: 'Which Capabilities Operators reach for most across the platform.',
  },
  'analytics.success': {
    label: 'Success rate',
    summary: 'The share of Operations that completed and verified across the platform.',
  },
  'audit.trail': {
    label: 'Audit trail',
    summary: 'An immutable record of every admin and system action, newest first.',
    detail:
      'Every mutation on the control plane, every suspension, and every emergency switch is written here with the actor, the action, the target, and the source address. The trail is append only and cannot be edited.',
  },
  'emergency.pause': {
    label: 'Pausing executions',
    summary: 'Holds every new execution platform wide. Nothing queued is lost.',
    detail:
      'While paused, the worker starts no new executions. Operators can still create and approve Operations; those wait with a clear event line that executions are paused, and run when you resume. Use this to stop the platform acting during an incident.',
  },
  'emergency.resume': {
    label: 'Resuming executions',
    summary: 'Lifts the pause so held Operations run again across every tenant.',
    detail:
      'Resuming clears the platform-wide hold. Every Operation that was waiting begins running in order. Like pausing, resuming is confirmed and written to the audit trail.',
  },
  'overview.emergency': {
    label: 'Emergency controls',
    summary:
      'Pause or resume executions platform wide. Every action is confirmed and fully audited.',
    detail:
      'Emergency controls are first-class, audited actions. Pausing all executions, or suspending a single Operator execution, always asks for confirmation and is written to the immutable audit trail.',
  },
};
