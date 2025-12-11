# BizPilot2
BizPilot v2.0 - Modern Multi-Business Management Platform

## Issue Tracking

This project uses [Beads](https://github.com/steveyegge/beads) for AI-native issue tracking. Issues are stored in `.beads/issues.jsonl` and synced via git.

### Quick Start

```bash
# Install Beads
curl -sSL https://raw.githubusercontent.com/steveyegge/beads/main/scripts/install.sh | bash

# Or with Go installed:
go install github.com/steveyegge/beads@latest

# Import existing issues
bd import -i .beads/issues.jsonl

# List issues
bd list

# Create a new issue
bd create "Issue title"

# Sync with remote
bd sync
```

For AI agents: See [AGENTS.md](./AGENTS.md) for guidelines and session-ending protocol.
