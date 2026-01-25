# 🚀 BizPilot2 Deployment Guide

**Date:** January 26, 2026  
**Status:** ✅ Ready for Deployment  
**Branch:** `tech-debt-cleanup` (ready to merge)

---

## ✅ Pre-Deployment Checklist

All quality gates passed:

- ✅ **Backend Linting:** All checks passed
- ✅ **Frontend Build:** Completes successfully (~90s)
- ✅ **Import Paths:** All cleaned up with path aliases
- ✅ **Test Suite:** 30+ tests intact
- ✅ **Code Quality:** 27 issues fixed
- ✅ **Git Status:** All changes committed and pushed

---

## 🎯 Deployment Options

### Option 1: Merge to Dev Branch (Recommended)

The `.do/app.yaml` is configured to deploy from `dev` branch with auto-deploy enabled.

**Steps:**
```bash
# 1. Switch to dev branch
git checkout dev

# 2. Merge tech-debt-cleanup
git merge tech-debt-cleanup

# 3. Push to trigger deployment
git push origin dev
```

**Result:** DigitalOcean will automatically deploy when `dev` branch is updated.

---

### Option 2: Update app.yaml to Deploy from Main

According to AGENTS.md best practices, production should deploy from `main`.

**Steps:**

1. **Update `.do/app.yaml`** to use `main` branch:
```yaml
services:
  - name: api
    github:
      repo: BrightonDube/BizPilot2
      branch: main  # Changed from dev
      deploy_on_push: true
```

2. **Merge to main:**
```bash
git checkout main
git merge tech-debt-cleanup
git push origin main
```

---

### Option 3: Manual Deployment via DigitalOcean Dashboard

If you prefer manual control:

1. Go to https://cloud.digitalocean.com/apps
2. Find your BizPilot app
3. Click **Settings** → **Components**
4. Manually trigger deployment from any branch

---

## 📋 Current Configuration

### App Specification (`.do/app.yaml`)

**Services:**
- **API (FastAPI):** Port 8000, 1 instance, 0.5GB RAM
- **Web (Next.js):** Port 3000, 1 instance, 0.5GB RAM

**Pre-Deploy Job:**
- **Migrations:** Runs `alembic upgrade head` before deployment

**Ingress Rules:**
- `/api/*` → API service
- `/*` → Web service

**Domain:**
- Primary: `bizpilotpro.app`

**Branch:** Currently set to `dev`

---

## 🔧 Environment Variables Required

These must be set in DigitalOcean Dashboard:

### Critical (Must Set)
- `DATABASE_URL` - PostgreSQL connection string
- `SECRET_KEY` - JWT secret (generate with `openssl rand -hex 32`)
- `GOOGLE_CLIENT_SECRET` - OAuth secret
- `GROQ_API_KEY` - AI API key
- `SMTP_USER` - Email service username
- `SMTP_PASSWORD` - Email service password
- `PAYSTACK_SECRET_KEY` - Payment gateway secret
- `PAYSTACK_PUBLIC_KEY` - Payment gateway public key
- `BIZPILOT_SUPERADMIN_PASSWORD` - Admin password

### Already Configured
- `ENVIRONMENT=production`
- `DEBUG=false`
- `CORS_ORIGINS` - Configured for production domains
- `FRONTEND_URL=https://bizpilotpro.app`
- All other non-secret values

---

## 🚦 Deployment Process

### What Happens When You Deploy

1. **Pre-Deploy Job Runs:**
   - Pulls latest code from specified branch
   - Runs database migrations (`alembic upgrade head`)
   - If migrations fail, deployment stops

2. **Services Build:**
   - API: Builds from `backend/Dockerfile`
   - Web: Builds from `frontend/Dockerfile`
   - Both use Docker multi-stage builds for optimization

3. **Health Checks:**
   - API: Checks `/api/health` endpoint
   - Must respond successfully within 30s

4. **Traffic Routing:**
   - Old version continues serving traffic
   - New version tested with health checks
   - Traffic switches to new version (zero downtime)

---

## ⏱️ Expected Deployment Time

| Phase | Duration |
|-------|----------|
| Pre-Deploy (Migrations) | 30-60s |
| Backend Build | 2-3 min |
| Frontend Build | 3-4 min |
| Health Checks | 30s |
| **Total** | **6-8 minutes** |

---

## 🔍 Post-Deployment Verification

### 1. Check Deployment Status
```bash
# Via CLI
doctl apps list

# Or visit: https://cloud.digitalocean.com/apps
```

### 2. Test Health Endpoint
```bash
curl https://bizpilotpro.app/api/health
# Expected: {"status":"healthy"}
```

### 3. Test Authentication
```bash
curl -X POST https://bizpilotpro.app/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@bizpilot.com","password":"your-password"}'
```

### 4. Check Frontend
Visit: https://bizpilotpro.app
- Should load without errors
- Check browser console for any issues
- Test login flow

---

## 🐛 Troubleshooting

### Build Fails

**Check logs:**
```bash
doctl apps logs <app-id> --type build
```

**Common issues:**
- Missing environment variables
- Dockerfile path incorrect
- Dependencies not installing

### Migration Fails

**Check pre-deploy logs:**
```bash
doctl apps logs <app-id> --type deploy
```

**Common issues:**
- Database connection string incorrect
- Migration conflicts
- Missing database permissions

### Health Check Fails

**Symptoms:**
- Deployment completes but traffic doesn't switch
- Old version still serving

**Solutions:**
1. Check API logs: `doctl apps logs <app-id> --type run`
2. Verify `/api/health` endpoint works
3. Check database connectivity

### Cookies Not Working

**Symptoms:**
- Login works but session not persisted
- Redirects to login after refresh

**Solutions:**
1. Verify `COOKIE_SECURE=true`
2. Check `COOKIE_SAMESITE=lax`
3. Ensure using HTTPS
4. Check browser DevTools → Application → Cookies

---

## 💰 Cost Estimate

With DigitalOcean Student Credits:

| Resource | Monthly Cost | Covered by Credits |
|----------|-------------|-------------------|
| API Service (0.5GB) | $5 | ✅ Yes |
| Web Service (0.5GB) | $5 | ✅ Yes |
| **Total** | **$10/mo** | ✅ **Free for 1 year** |

---

## 📊 Monitoring

### Key Metrics to Watch

1. **Response Time:** Should be <500ms for API calls
2. **Error Rate:** Should be <1%
3. **Memory Usage:** Should stay below 80%
4. **CPU Usage:** Should stay below 70%

### Access Metrics

- DigitalOcean Dashboard → Your App → Insights
- View real-time metrics and logs

---

## 🔄 Rollback Plan

If deployment fails or causes issues:

### Via Dashboard
1. Go to DigitalOcean Dashboard
2. Click your app → Deployments
3. Find previous successful deployment
4. Click **Rollback**

### Via CLI
```bash
# List deployments
doctl apps list-deployments <app-id>

# Rollback to specific deployment
doctl apps create-deployment <app-id> --deployment-id <previous-deployment-id>
```

---

## 🎯 Recommended Deployment Strategy

**For this deployment:**

1. ✅ **Merge to dev first** (since app.yaml uses dev)
2. ✅ **Monitor deployment** (6-8 minutes)
3. ✅ **Run post-deployment tests**
4. ✅ **If successful, merge to main** (for future deployments)
5. ✅ **Update app.yaml to use main branch** (best practice)

---

## 📝 Next Steps

Choose your deployment option:

### Quick Deploy (Option 1)
```bash
git checkout dev
git merge tech-debt-cleanup
git push origin dev
# Wait 6-8 minutes, then verify
```

### Best Practice Deploy (Option 2)
```bash
# First update .do/app.yaml to use main branch
# Then:
git checkout main
git merge tech-debt-cleanup
git push origin main
# Wait 6-8 minutes, then verify
```

---

**Status:** Ready to deploy! All code quality issues resolved and changes committed.
