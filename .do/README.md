# DigitalOcean App Platform Deployment

## Why DigitalOcean over Render?

| Issue | Render Free Tier | DigitalOcean |
|-------|-----------------|--------------|
| Cross-subdomain cookies | ❌ Blocked by browsers | ✅ Same domain routing |
| Cold starts | ❌ 5-30s after sleep | ✅ Always-on (paid tier) |
| Custom domains | ❌ Paid only | ✅ Included |
| Price with credits | N/A | **Free** (1 year credits) |

## Architecture

```
https://bizpilot-xxxxx.ondigitalocean.app/
├── /api/*     → FastAPI backend (port 8000)
└── /*         → Next.js frontend (port 3000)
```

Both services share the **same domain**, so cookies work without cross-origin issues.

## Prerequisites

1. **DigitalOcean Account** with student credits
2. **doctl CLI** (optional, can use web UI)
3. **GitHub repo** connected to DigitalOcean

## Deploy via Web UI (Recommended)

1. Go to https://cloud.digitalocean.com/apps
2. Click **Create App**
3. Select **GitHub** → Connect your repo
4. Select `BrightonDube/BizPilot2`
5. DigitalOcean will auto-detect the `.do/app.yaml` spec
6. Review and **Create Resources**

## Deploy via CLI

```bash
# Install doctl
# Windows: scoop install doctl
# Mac: brew install doctl

# Authenticate
doctl auth init

# Create app from spec
doctl apps create --spec .do/app.yaml

# Check status
doctl apps list
```

## Post-Deployment Setup

### 1. Set Environment Variables

In DigitalOcean Dashboard → App → Settings → App-Level Environment Variables:

```
DATABASE_URL=postgresql://user:pass@host/dbname?sslmode=require
SECRET_KEY=<generate with: openssl rand -hex 32>
```

### 2. Using Neon Database

If keeping Neon instead of DO managed DB:

1. Get your Neon pooled connection string from Neon dashboard
2. Add as `DATABASE_URL` in DO app settings
3. Use the **pooled** connection URL (with `-pooler` in hostname)

### 3. Verify Deployment

```bash
# Check app URL
doctl apps list

# Test health endpoint
curl https://your-app.ondigitalocean.app/api/health

# Test login
curl -X POST https://your-app.ondigitalocean.app/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@bizpilot.co.za","password":"Demo@2024"}'
```

## Costs with Student Credits

| Resource | Monthly Cost |
|----------|-------------|
| Web service (2x) | $10 |
| **Total** | **$10/mo** (covered by credits) |

Your 1-year credits easily cover this deployment.

## Troubleshooting

### Cookies not working
- Verify `COOKIE_SECURE=true` and `COOKIE_SAMESITE=lax`
- Check browser DevTools → Application → Cookies

### Build fails
- Check build logs in DO dashboard
- Ensure Dockerfile paths are correct

### Database connection fails
- Verify `DATABASE_URL` is set correctly
- For Neon, use the pooled connection string
