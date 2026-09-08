# Security

Security holds the protections on your own account: the password you sign in with, two step verification, and what happens to your sessions when either changes. This page covers what is there and what is not.

Security lives under **Account**, at `/app/security`.

Everything on this page is about your account, not about a Workspace. It is not gated by any Workspace role, and changing it affects you and nobody else.

## Your password

**Change password** asks for your current password, then the new one twice.

Being signed in is not treated as proof of identity. A session outlives the moment it was created, so somebody who sat down at a laptop you left open would otherwise be able to take the account over without knowing anything. Proving the current password is what stops that, and it is why the form asks for a password you have just typed to get here.

A password must be at least 12 characters. The hint on the form explains the reasoning:

> Length protects an account better than punctuation does.

The new password must differ from the current one.

### What a password change does to your sessions

Changing your password immediately ends **every other session for the account** while keeping the one you are using.

The result says so in plain numbers:

> Your password has been changed. 3 other sessions were signed out. You are still signed in here.

Or, when there were none:

> Your password has been changed. There were no other sessions to sign out.

That count is the point. If you are changing your password because you think somebody else has it, the number tells you whether anyone else was actually signed in, and confirms they are not any more.

### Accounts without a password

An account created by signing in through GitHub has no password. The section says so and offers nothing to change:

> You sign in through GitHub, so this account has no password to change. Your GitHub account controls access.

For those accounts, access is controlled where the identity lives. Protect the GitHub account.

## Two step verification

Two step verification adds a short code from an authenticator app on top of your password.

### Turning it on

**Begin setup** generates a fresh secret and shows three ways to give it to your authenticator:

- A **QR code** to scan. This is what most people will use, and it is the one step that cannot go wrong through a typo. It is drawn on white whatever your theme, because a dark background under a QR code inverts it and many scanners will not read it.
- A **setup key**, the same secret as text, with a copy control. Use this when you are on a phone and cannot scan your own screen.
- The full **provisioning URL**, tucked behind a disclosure, for apps that take one.

Any TOTP app works: Google Authenticator, 1Password, Authy, or whatever you already use. It will show a six digit code that changes every thirty seconds.

Setup is not finished until you prove it works. Enter a current code and press **Enable protection**. Until that code verifies, nothing is turned on, so a mis-scanned secret cannot lock you out.

### Signing in with it on

Sign in with your email and password as usual. Instead of a session, you get a short-lived challenge, and the app asks for the six digit code.

The challenge lasts five minutes and is single use. A wrong code means starting the sign in again rather than retrying against the same challenge.

### Turning it off

**Turn off protection** requires your account password, for the same reason changing a password does. A session on its own is not enough to remove a protection.

### There are no recovery codes

SlideOps does not issue backup or recovery codes, and there is no self-service way back into an account whose authenticator has been lost.

Plan for that before you turn it on. Keep the setup key somewhere safe, or enrol a second device, or use an authenticator that syncs across your devices. If you lose access, recovery means whoever operates this SlideOps deployment intervening on the account.

### Administrators must have it on

An account that carries the platform admin role must have two step verification enabled before the control plane will open in production. An admin who is turned away lands here with the reason at the top of the page:

> The admin area needs this turned on. Two step verification is below. Turn it on and the control plane opens.

## Sessions

A session is created when you sign in and is what every request after that is authorised by.

The token lives in an `HttpOnly` cookie, so page scripts can never read it, and it is marked `Secure` in production. The token itself is opaque and random; it carries no information about you and cannot be forged offline.

Sessions are long lived and roll forward on activity. Using SlideOps keeps your session alive; leaving it alone lets it expire.

### Ending a session

There are two ways a session ends.

**Signing out** ends the session you are using. The session is deleted on the server, not merely forgotten by the browser. That distinction matters: a token that was captured cannot be replayed afterwards, because there is nothing left for it to resolve to.

**Changing your password** ends every other session for the account, as described above, and keeps the one you are in.

Ending a session does not affect anything you did with it. Operations you ran stay run, Services stay deployed, and records stay in [Activity](/docs/observe/activity). It ends access, not history.

### What is not here

There is **no session list**. SlideOps does not show you which devices are signed in, where from, or when they were last used, and there is no button to end one session in particular.

The tool for "sign everything else out" is the password change. It is a blunt instrument by design, and it is the only one.

## This deployment

The top of the page shows the **API base** this app is talking to and a link to its **API reference**.

Neither is a secret. They are here because an Operator running SlideOps on their own server had no way to find the URL their own app was calling, or the reference for it, without asking somebody. The base is read from the running client, so it is always the address this build actually calls rather than one written down and left to drift.

## Related

- [Roles and permissions](/docs/account/roles-and-permissions) for access inside a Workspace
- [Credentials](/docs/configure/credentials) for the secrets SlideOps holds for your infrastructure
- [SSH keys](/docs/configure/ssh-keys) for how SlideOps authenticates to your Servers
