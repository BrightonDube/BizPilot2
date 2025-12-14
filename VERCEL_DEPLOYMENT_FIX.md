# Vercel Deployment Fix for BizPilot2

## Problem
Error: `/vercel/path0/frontend/frontend/.next/routes-manifest.json` not found

The doubled `frontend/frontend` path indicates a configuration conflict.

## Root Cause
**Vercel Root Directory setting + vercel.json both navigate to `frontend/`**, causing:
1. Vercel sets working directory to `frontend/` (from Root Directory setting)
2. Build commands in vercel.json also `cd frontend/`
3. Result: Vercel looks in `frontend/frontend/.next/`

## Solution (Choose ONE)

### ✅ Option 1: Deploy from Repository Root (RECOMMENDED)

**In Vercel Dashboard:**
1. Go to Project Settings → Build & Development Settings
2. Set **Root Directory** to `.` (or leave blank for repo root)
3. Save settings

**Local Configuration:**
- Keep `vercel.json` at repository root with:
```json
{
  "buildCommand": "cd frontend && pnpm install && pnpm build",
  "outputDirectory": "frontend/.next"
}
```
- Delete `frontend/vercel.json` (already done)

**Redeploy** after changing Root Directory setting.

---

### Option 2: Deploy from frontend/ Directory

**In Vercel Dashboard:**
1. Set **Root Directory** to `frontend`
2. Save settings

**Local Configuration:**
- Delete ALL `vercel.json` files (root and frontend/)
- Let Vercel auto-detect Next.js configuration

**Redeploy** after deleting vercel.json files.

---

## Current State
- ✅ Root `vercel.json` updated with correct commands
- ✅ `frontend/vercel.json` deleted
- ⚠️ **ACTION REQUIRED**: Update Vercel Dashboard Root Directory to `.` (repo root)

## Verification Steps
After redeploying:
1. Check build logs for correct paths
2. Verify `.next` directory is found at `frontend/.next`
3. Confirm no `frontend/frontend` paths in logs
4. Test deployed application

## Related Files
- `@/vercel.json` - Root configuration (updated)
- `@/frontend/vercel.json` - Deleted to prevent conflicts
- `@/frontend/next.config.mjs` - Next.js config (no changes needed)
