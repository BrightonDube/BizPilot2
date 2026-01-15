# AI Agent Guidelines for BizPilot2

This document provides guidelines for AI coding agents working on the BizPilot2 project. It includes a session-ending protocol to ensure proper issue tracking hygiene and database synchronization.

## 🎯 Project Management Philosophy

**THE ONLY BUILDING GUIDE IS BEADS ISSUES**
- All work must be tracked in Beads issues (`.beads/issues.jsonl`)
- Use `bd` commands to check, create, and manage issues
- Do not start work without a corresponding Beads issue
- The project is built by working through Beads issues systematically

## 📦 Package Manager

**This project uses pnpm, NOT npm**
- Always use `pnpm` commands (e.g., `pnpm install`, `pnpm run dev`)
- Never use `npm` or `yarn` commands
- Scripts are defined in `package.json` and run with `pnpm run <script>`

## ⚠️ FIRST: Read the Workflow Script

**Before starting any work, read the workflow script:**
- Location: `.github/WORKFLOW_SCRIPT.md`
- This script defines the exact steps to follow for every feature
- Follow it exactly - do not deviate

## Issue Tracking with Beads

This project uses [Beads](https://github.com/steveyegge/beads) for AI-native issue tracking. Issues are stored in `.beads/issues.jsonl` and synced via git.

### Essential Commands

**Always use `bd` commands to interact with Beads:**

```bash
# List all issues
bd list

# Create a new issue
bd create "Issue title"

# View issue details
bd show <issue-id>

# Update issue status
bd update <issue-id> --status in_progress
bd update <issue-id> --status done

# Find ready work (issues with no blockers)
bd ready

# List by priority
bd list --sort priority

# Sync with git remote (using pnpm)
pnpm beads:sync
```

## Session-Ending Protocol

**IMPORTANT:** Before ending your session, complete the following steps to maintain database hygiene and prevent lost work.

### 1. File/Update Issues for Remaining Work

- Proactively create issues for any discovered bugs, TODOs, or follow-up tasks
- Close completed issues and update status for in-progress work
- Use clear, descriptive titles and include relevant context in descriptions

```bash
# Create issues for discovered work
bd create "Bug: Description of bug found" --priority 0
bd create "TODO: Feature or improvement needed" --priority 2

# Update issue status
bd update <issue-id> --status done
bd update <issue-id> --status in_progress
```

### 2. Run Quality Gates (If Applicable)

Only if code changes were made:
- Run linters
- Run tests
- Run builds
- File P0 issues if builds are broken

```bash
# Frontend quality gates (use pnpm)
cd frontend
pnpm run lint
pnpm run build
pnpm run test  # if tests exist

# Backend quality gates
cd backend
pytest
flake8

# Always use pnpm for Node.js commands, never npm
```

### 3. Sync the Issue Tracker Carefully

Work methodically to ensure local and remote issues merge safely on the `dev` branch:
- Handle git conflicts thoughtfully (sometimes accepting remote and re-importing)
- Goal: clean reconciliation where no issues are lost

```bash
# Sync issues with git remote
git checkout dev
pnpm beads:sync

# If conflicts occur, you may need to:
# 1. Pull latest changes
# 2. Resolve conflicts
# 3. Re-import and sync again
bd import -i .beads/issues.jsonl
pnpm beads:sync
```

### 4. Verify Clean State

Ensure all changes are committed and pushed:
- All code changes committed and pushed
- No untracked files remain
- Issue database is in sync

```bash
# Check git status
git status

# Verify beads state
bd list
```

### 5. Choose Next Work

Provide context for the next session:
- Summarize completed work
- Identify the next highest-priority issue
- Include relevant context or blockers

```bash
# Find ready work (issues with no blockers)
bd ready

# List by priority
bd list --sort priority
```

## The Magic: Distributed Database via Git

Beads acts like a centralized database, but it's actually distributed via git:

✅ Full query capabilities (dependencies, ready work, etc.)
✅ Fast local operations (<100ms via SQLite)
✅ Shared state across all machines (via git)
✅ No server, no daemon required, no configuration
✅ AI-assisted merge conflict resolution

**How it works:** Each machine has a local SQLite cache (`.beads/*.db`, gitignored). The source of truth is `.beads/issues.jsonl` which is committed to git.

## Best Practices for AI Agents

1. **Start each session** by syncing: `pnpm beads:sync`
2. **Check Beads issues** using `bd` commands before starting work
3. **Track your work** by updating issue status as you go
4. **Create issues** for anything you discover that needs follow-up
5. **End each session** by following the Session-Ending Protocol above
6. **Be descriptive** in issue titles and descriptions for context
7. **Use priorities** (P0 = critical, P1 = high, P2 = medium, P3 = low)
8. **Always use pnpm** for Node.js package management, never npm or yarn
9. **Refer to AGENTS.md** before ending any agent session

## Before Ending Any Agent Session

**MANDATORY CHECKLIST:**
1. ✅ Review AGENTS.md Session-Ending Protocol
2. ✅ Run quality gates (lint, test, build)
3. ✅ Create/update Beads issues for any remaining work
4. ✅ Sync Beads database: `pnpm beads:sync`
5. ✅ Verify clean git state: `git status`
6. ✅ Commit and push all changes
7. ✅ Use `bd` commands to verify issue state

---

*This protocol ensures database hygiene and prevents the common problem of agents creating issues during work but forgetting to sync them at session end.*
