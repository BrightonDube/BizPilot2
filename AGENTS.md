# AI Agent Guidelines for BizPilot2

This document provides guidelines for AI coding agents working on the BizPilot2 project. It includes a session-ending protocol to ensure proper issue tracking hygiene and database synchronization.

## Issue Tracking with Beads

This project uses [Beads](https://github.com/steveyegge/beads) for AI-native issue tracking. Issues are stored in `.beads/issues.jsonl` and synced via git.

### Essential Commands

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

# Sync with git remote
bd sync
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
# Example quality gate commands (adjust for your stack)
# npm run lint && npm run test && npm run build
# pytest && flake8
```

### 3. Sync the Issue Tracker Carefully

Work methodically to ensure local and remote issues merge safely:
- Handle git conflicts thoughtfully (sometimes accepting remote and re-importing)
- Goal: clean reconciliation where no issues are lost

```bash
# Sync issues with git remote
bd sync

# If conflicts occur, you may need to:
# 1. Pull latest changes
# 2. Resolve conflicts
# 3. Re-import and sync again
bd import -i .beads/issues.jsonl
bd sync
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

1. **Start each session** by syncing: `bd sync`
2. **Track your work** by updating issue status as you go
3. **Create issues** for anything you discover that needs follow-up
4. **End each session** by following the Session-Ending Protocol above
5. **Be descriptive** in issue titles and descriptions for context
6. **Use priorities** (P0 = critical, P1 = high, P2 = medium, P3 = low)

---

*This protocol ensures database hygiene and prevents the common problem of agents creating issues during work but forgetting to sync them at session end.*
