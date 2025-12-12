# BizPilot Development Workflow Script

This script defines the standard workflow for building features from beads issues. **Run this workflow for every feature.**

## Prerequisites
- Beads CLI installed: `go install github.com/steveyegge/beads/cmd/bd@latest`
- Backend virtual environment set up: `cd backend && source venv/bin/activate`
- Frontend dependencies installed: `cd frontend && pnpm install`

---

## 🔄 WORKFLOW SCRIPT (Follow for EVERY Feature)

### Step 1: Read the Issue
```bash
# List available issues
bd list

# Pick the next priority issue and read it
bd show <issue-id>

# Mark as in progress
bd update <issue-id> --status in_progress
```

### Step 2: Build the Feature
- Implement the feature based on the issue description
- Follow existing code patterns and conventions
- Create all necessary files (models, schemas, services, API endpoints, UI components)

### Step 3: Create Unit Tests
- Write comprehensive tests for the new feature
- Test all CRUD operations, edge cases, and error handling
- Ensure tests are meaningful (not useless tests)

### Step 4: Run Tests
```bash
# Backend tests
cd backend && source venv/bin/activate && python -m pytest app/tests/ -v

# Frontend build (acts as type checking/linting)
cd frontend && pnpm build
```

### Step 5: Fix Failing Tests
If tests fail:
```bash
# Create a beads issue for each failure
bd create "Bug: <description of test failure>" --priority 0

# Work on the issue until fixed
bd update <issue-id> --status in_progress
# ... fix the code ...
bd close <issue-id>
```
Repeat until ALL tests pass.

### Step 6: Build Application
```bash
# Backend - verify imports and syntax
cd backend && source venv/bin/activate && python -c "from app.main import app; print('Backend OK')"

# Frontend - full production build
cd frontend && pnpm build
```
If build fails, create issues and fix them.

### Step 7: Code Review (4 Times)
Perform 4 code reviews using the code_review tool:

**Review 1: Correctness**
- Does the code implement the feature correctly?
- Are there any logical errors?
- Are edge cases handled?

**Review 2: Security**
- Are there any security vulnerabilities?
- Is input validation present?
- Are authentication/authorization checks in place?

**Review 3: Performance**
- Are there any performance issues?
- Are database queries optimized?
- Is pagination implemented where needed?

**Review 4: Code Quality**
- Is the code clean and readable?
- Are naming conventions followed?
- Is there proper error handling?

For each issue found:
```bash
# Create a beads issue
bd create "Review: <description of issue>" --priority 1

# Fix the issue
bd update <issue-id> --status in_progress
# ... implement fix ...
bd close <issue-id>
```

### Step 8: Close Feature and Report Progress
```bash
# Close the feature issue
bd close <feature-issue-id>

# Report progress (commits and pushes changes)
# Use report_progress tool with checklist update
```

### Step 9: Move to Next Feature
```bash
# List remaining issues
bd list

# Pick next priority issue
bd show <next-issue-id>
```

---

## 📋 Quick Reference Commands

```bash
# Beads
bd list                              # List all issues
bd show <id>                         # Show issue details
bd update <id> --status in_progress  # Mark in progress
bd update <id> --status done         # Mark done
bd close <id>                        # Close issue
bd create "Title" --priority N       # Create issue (N: 0=P0, 1=P1, 2=P2, 3=P3)
bd sync                              # Sync with git

# Backend Testing
cd backend && source venv/bin/activate
python -m pytest app/tests/ -v       # Run all tests
python -m pytest app/tests/test_X.py -v  # Run specific test file

# Frontend Building
cd frontend && pnpm build            # Production build
cd frontend && pnpm dev              # Development server

# Git (via report_progress tool)
# Never use git directly - always use report_progress
```

---

## ⚠️ Important Rules

1. **Never skip tests** - Every feature must have tests
2. **Never skip code reviews** - Do all 4 reviews for each feature
3. **Create issues for problems** - Don't just fix, track in beads
4. **Report progress frequently** - Commit after each feature
5. **Follow the script exactly** - Don't deviate from the workflow

---

## 🎯 Current Session Checklist

When starting a session:
- [ ] Read this workflow script first
- [ ] Check `bd list` for current state
- [ ] Identify next feature to work on
- [ ] Follow the 9-step workflow above
- [ ] Before ending: `bd sync` and report_progress
