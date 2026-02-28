# Contributing

## Git Workflow

**Direct pushes to `main` are not allowed.** All changes go through pull requests.

### Steps

1. Create a branch from `main`:
   ```bash
   git checkout main && git pull origin main
   git checkout -b feat/my-feature
   ```

2. Make your changes, commit with clear messages.

3. Push your branch and open a PR:
   ```bash
   git push -u origin feat/my-feature
   gh pr create --title "feat: my feature" --body "description"
   ```

4. Wait for at least **1 approval** from a reviewer.

5. Merge via GitHub (squash or merge commit). Delete the branch after.

### Branch Naming

| Prefix   | Use for                    |
|----------|----------------------------|
| `feat/`  | New features               |
| `fix/`   | Bug fixes                  |
| `chore/` | Tooling, deps, config      |
| `docs/`  | Documentation only changes |

### Rules

- Never push directly to `main`
- Never force-push to `main`
- Never merge your own PR without a review
- AI agents (Claude, Copilot, etc.) must work on branches and open PRs — never commit to `main`
