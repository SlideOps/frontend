# CLAUDE.md

Guidance for Claude Code when working in this repository (`frontend`, including
the `frontend-seo` worktree of the same repo).

## Git remotes — read this before any `git push`

This repo has **two remotes**, tied to two different GitHub accounts. Getting
this wrong pushes real commits to the wrong GitHub account and, worse, to the
wrong deploy target. Check `git remote -v` if ever in doubt, but the rule is
fixed and does not change based on branch name or task:

| Remote | URL | GitHub account | What it is |
|---|---|---|---|
| `origin` | `git@github.com:SlideOps/frontend.git` | `0xSemantic` (default SSH key) | Personal/dev mirror. Feature branches are normal here. |
| `slideops` | `git@github-slideops:slideopstech/slideops-frontend.git` | `slideopstech` (key: `~/.ssh/id_ed25519_slideops`, forced via `IdentitiesOnly yes` in `~/.ssh/config`) | **Production.** Netlify deploys from this repo's `main`. |

Rules, no exceptions:

1. **Never push to `slideopstech/slideops-frontend` using the `0xSemantic`
   account.** That means: always push it through the `slideops` remote (its
   URL forces the right SSH key), never by adding/renaming a remote to point
   at it with a plain `github.com` URL, and never by pushing it from a
   different clone/worktree that has `slideopstech/slideops-frontend`
   configured under the wrong key.
2. **Push directly to `main` on `slideops`.** Not a feature branch, not a PR
   branch, even if that is the normal workflow on `origin`. Production reads
   `main` directly.
   - If local work is sitting on a feature branch, land it as
     `git push slideops <local-branch>:main` — a fast-forward when
     `slideops/main` is already its ancestor, otherwise rebase/cherry-pick
     just the commits that belong in production onto `slideops/main` first.
     Never push a whole feature branch (with unrelated in-progress commits)
     onto `main` just because it happens to contain the change that was
     asked for.
   - Never leave a stray branch behind on `slideops` after landing on `main`;
     delete it there if a push accidentally created one
     (`git push slideops --delete <branch>`).
3. **`origin` is the safe default for everything else** — feature branches,
   personal pushes, anything not explicitly meant for production right now.
   Pushing to `origin` never touches production.
4. If genuinely unsure which account a push will use, verify first rather
   than guess:
   ```
   ssh -T git@github-slideops   # should answer "Hi slideopstech!"
   ssh -T git@github.com        # should answer "Hi 0xSemantic!"
   ```
   A push to `slideops` uses the first identity; a push to `origin` uses the
   second. If either answers with the wrong username, stop and ask rather
   than push.

This came from a real incident: a push meant for production landed on
`origin` as a branch instead of on `slideops`'s `main` directly, requiring a
manual cleanup (deleting the stray branch from both remotes, then
fast-forwarding `slideops/main` with just the intended commits). Follow the
rule above exactly so that never has to happen again.
