# CLAUDE.md

Guidance for Claude Code when working in this repository (`frontend`, including
the `frontend-seo` worktree of the same repo).

# GitHub Account and Repository Ownership Rules

This is a permanent operational boundary, not a preference. It governs every
`git push` made from this checkout (or any worktree of it). Two different
GitHub accounts are involved, and they are never interchangeable:

| Account | Owns | Repository |
|---|---|---|
| `0xSemantic` | The SlideOps GitHub **organization**'s repos | `SlideOps/frontend` (remote `origin`), `SlideOps/backend`, and any other `SlideOps/*` repo |
| `slideopstech` | The **production** frontend, exclusively | `slideopstech/slideops-frontend` (remote `slideops`) |

`slideopstech/slideops-frontend` is a separate repository from `SlideOps/frontend`.
They are not the same thing and are never to be confused. Production (Netlify)
deploys from `slideopstech/slideops-frontend`'s `main`. `SlideOps/frontend` is
the organization's own copy and is **not** what is live.

## 1. Absolute ownership rule

For `slideopstech/slideops-frontend`:

> `slideopstech` MUST be the authenticating GitHub account, the Git **author**,
> and the Git **committer** on every commit pushed there. All three, every time.

NEVER:
- push to `slideopstech/slideops-frontend` using the `0xSemantic` account, SSH
  identity, `gh` auth, PAT, or token, however briefly or "just to test something";
- create a commit locally with `0xSemantic` as author/committer and then push
  it (even via the correct `slideopstech`-authenticated remote) to
  `slideopstech/slideops-frontend` — **the transport account being correct does
  not make the commit's author/committer correct**; these are independently
  checked, and getting the push transport right is not enough on its own;
- assume the remote accepting the push means the identity was right;
- push a feature/PR branch to `slideopstech/slideops-frontend` — it takes a
  direct push to `main` only, never a branch;
- leave a stray branch behind there if one gets created by mistake — delete it
  (`git push slideops --delete <branch>`);
- "fix" any of the above by repointing Vercel/Netlify's production source,
  renaming accounts, or pushing the organization repo instead because the
  identity for it was already authenticated and convenient.

For `SlideOps/*` (the organization's repos, including `origin` on this repo):
use `0xSemantic` for authentication, author, and committer. Do not switch
those to `slideopstech` — the organization repos are not production and do not
need the production identity.

## 2. Resolved identities (do not re-derive these by guessing)

```
0xSemantic:    0xSemantic <74856946+0xSemantic@users.noreply.github.com>
slideopstech:  slideopstech <311696034+slideopstech@users.noreply.github.com>
```

Both are GitHub's own `{numeric-id}+{username}@users.noreply.github.com`
format, confirmed against each account's real numeric id (`0xSemantic` is the
id already used in this checkout's existing commits; `slideopstech`'s id,
`311696034`, was read from `https://api.github.com/users/slideopstech`). If a
commit for `slideopstech/slideops-frontend` ever needs an identity not listed
here, look it up the same way — never invent one, since an email that does not
match the account's real noreply address shows on GitHub as unverified and
unlinked, which defeats the entire point of this rule.

## 3. Mandatory pre-push verification

Before **every** push from this checkout, run and actually read the output —
do not rely on memory, and do not assume the currently configured identity is
already correct:

```bash
git remote -v
git status
git branch --show-current
git config user.name
git config user.email
```

Then answer, explicitly, before pushing:

1. Which repository does this push actually go to — `origin` or `slideops`?
2. Is that repository `slideopstech/slideops-frontend` (production)?
3. If yes: does `git config user.name`/`user.email` **right now** read as the
   `slideopstech` identity above? If not, set it first — do not commit and
   fix authorship after the fact.
4. Is the destination `main`, pushed directly (never a branch), for that repo?

If any answer is unclear, stop and ask rather than guess. Do not pick whichever
identity happens to already be configured because it's convenient.

## 4. Production push procedure

```bash
# 1. Confirm the remote really is production
git remote -v | grep slideops   # -> git@github-slideops:slideopstech/slideops-frontend.git

# 2. Confirm the SSH identity that URL will actually use
ssh -T git@github-slideops      # must answer "Hi slideopstech!"

# 3. Set the LOCAL identity for the commit(s) about to be made -- this is
#    independent of step 2, and both must be right
git config user.name "slideopstech"
git config user.email "311696034+slideopstech@users.noreply.github.com"

# 4. Commit, then restore the default identity for this checkout's normal
#    (origin / SlideOps-org) work
git add -A && git commit -m "..."
git config user.name "0xSemantic"
git config user.email "74856946+0xSemantic@users.noreply.github.com"

# 5. Push straight to main, never a branch, and never force unless a prior
#    mistake genuinely requires correcting production history -- and even
#    then, only with the user's explicit, specific go-ahead for that push
git push slideops <local-branch-or-commit>:main

# 6. Verify what actually landed
git ls-remote slideops main
```

Everything not meant for production (dev work, feature branches, anything on
`origin`) uses the default `0xSemantic` identity as normal — do not switch to
`slideopstech` for that; section 1 is symmetric.

## 5. Why this matters, concretely

This rule exists because it was violated twice in the same incident: first a
push meant for production landed on `origin` as a branch instead of directly
on `slideops`'s `main`; then, after that was fixed, the commits that did reach
`slideopstech/slideops-frontend`'s `main` were still authored as `0xSemantic`,
because the push transport being correct (the right SSH key, the right
account accepting the push) was mistaken for the commit identity also being
correct. They are two separate things and both have to be right. Those two
specific commits were left as-is rather than rewriting shared production
history to fix them; every commit from this point on follows the procedure
above instead.
