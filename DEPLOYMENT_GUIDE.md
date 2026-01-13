# BizPilot DigitalOcean Deployment Guide

## Step 1: Commit and Push Changes

```bash
cd d:\Downloads\Personal_Projects\BizPilot2
git add .
git commit -m "feat: Add DigitalOcean App Platform deployment config"
git push origin main
```

---

## Step 2: Create DigitalOcean App

1. Go to **https://cloud.digitalocean.com/apps**
2. Click **"Create App"**
3. Select **GitHub** as source
4. Authorize DigitalOcean to access your GitHub (if not done)
5. Select repository: **BrightonDube/BizPilot2**
6. Select branch: **main**
7. DigitalOcean will auto-detect the `.do/app.yaml` spec
8. Click **"Next"** through the wizard
9. Review resources (should show 2 services: api + web)
10. Click **"Create Resources"**

---

## Step 3: Set Environment Variables

After the app is created, go to:
**App Dashboard → Settings → App-Level Environment Variables**

### Backend (api) Environment Variables

Click on the **api** component, then **Settings → Environment Variables**.

Copy and paste each of these:

| Key | Value |
|-----|-------|
| `DATABASE_URL` | Your PostgreSQL connection string |
| `SECRET_KEY` | Generate with `openssl rand -hex 32` |
| `ALGORITHM` | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `30` |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `7` |
| `ENVIRONMENT` | `production` |
| `DEBUG` | `false` |
| `COOKIE_DOMAIN` | `` (leave empty) |
| `COOKIE_SECURE` | `true` |
| `COOKIE_SAMESITE` | `lax` |
| `GOOGLE_CLIENT_ID` | Your Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | Your Google OAuth Client Secret |

### Using DigitalOcean Managed PostgreSQL

Set `DATABASE_URL` with your connection string:

```
DATABASE_URL=postgresql://doadmin:PASSWORD@host.m.db.ondigitalocean.com:25060/defaultdb?sslmode=require
```

---

## Migration Strategy (Required)

### Production (DigitalOcean App Platform)

Migrations are applied using a **PRE_DEPLOY job** defined in `.do/app.yaml` (`release-migrate`).

- The API container **does not** run `alembic upgrade head` on startup.
- If the migration job fails, DigitalOcean will **rollback** the deployment.

Required env vars for the migration job:

- `DATABASE_URL`
- `SECRET_KEY` (can be any valid value; migrations don't use auth, but settings validation requires it)

### Local Development (docker-compose)

Local development should apply migrations before starting the API.

Options:

1) Run the migrate service:

```bash
docker-compose -f infrastructure/docker/docker-compose.yml up --build migrate
```

2) Or run Alembic manually from `backend/`:

```bash
python -m alembic -c alembic.ini upgrade head
```

**⚠️ IMPORTANT:** After app deploys, get your app URL (e.g., `https://bizpilot-xxxxx.ondigitalocean.app`) and add:

| Key | Value |
|-----|-------|
| `CORS_ORIGINS` | `["https://YOUR-APP-URL.ondigitalocean.app"]` |

### Frontend (web) Environment Variables

Click on the **web** component, then **Settings → Environment Variables**.

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `NEXTAUTH_SECRET` | Generate with `openssl rand -hex 32` |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Your Google OAuth Client ID |
| `NEXT_PUBLIC_ENABLE_AI_ASSISTANT` | `true` |
| `NEXT_PUBLIC_ENABLE_PWA` | `false` |

**⚠️ IMPORTANT:** After app deploys, add these with your actual app URL:

| Key | Value |
|-----|-------|
| `NEXT_PUBLIC_API_URL` | `https://YOUR-APP-URL.ondigitalocean.app/api/v1` |
| `NEXTAUTH_URL` | `https://YOUR-APP-URL.ondigitalocean.app` |

---

## Step 4: Trigger Redeploy

After setting environment variables:

1. Go to **App Dashboard → Activity**
2. Click **"Deploy"** → **"Deploy Latest Commit"**
3. Wait for both services to build and deploy (5-10 minutes)

---

## Step 5: Update Google OAuth (Optional)

If using Google Sign-In:

1. Go to **https://console.cloud.google.com/apis/credentials**
2. Select your OAuth 2.0 Client
3. Add to **Authorized JavaScript origins**:
   ```
   https://YOUR-APP-URL.ondigitalocean.app
   ```
4. Add to **Authorized redirect URIs**:
   ```
   https://YOUR-APP-URL.ondigitalocean.app/api/v1/oauth/google/callback
   ```

---

## Step 6: Verify Deployment

### Test Health Endpoint
```bash
curl https://YOUR-APP-URL.ondigitalocean.app/api/health
```

Expected response:
```json
{"status": "healthy", "version": "2.0.0"}
```

### Test Login
```bash
curl -X POST https://YOUR-APP-URL.ondigitalocean.app/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@bizpilot.co.za","password":"Demo@2024"}'
```

### Open in Browser
Visit: `https://YOUR-APP-URL.ondigitalocean.app`

---

## Quick Reference: Ready-to-Copy Values

### Backend Environment Variables (Copy All)
```env
DATABASE_URL=<your-postgresql-connection-string>
SECRET_KEY=<generate-with-openssl-rand-hex-32>
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7
ENVIRONMENT=production
DEBUG=false
COOKIE_DOMAIN=
COOKIE_SECURE=true
COOKIE_SAMESITE=lax
GOOGLE_CLIENT_ID=<your-google-oauth-client-id>
GOOGLE_CLIENT_SECRET=<your-google-oauth-client-secret>
```

### Frontend Environment Variables (Copy All)
```env
NODE_ENV=production
NEXTAUTH_SECRET=<generate-with-openssl-rand-hex-32>
NEXT_PUBLIC_GOOGLE_CLIENT_ID=<your-google-oauth-client-id>
NEXT_PUBLIC_ENABLE_AI_ASSISTANT=true
NEXT_PUBLIC_ENABLE_PWA=false
```

---

## Troubleshooting

### Build Fails
- Check **Activity → Build Logs** for errors
- Ensure Dockerfiles exist in `backend/` and `frontend/`

### 401 Unauthorized After Login
- Verify `CORS_ORIGINS` includes your exact app URL
- Verify `COOKIE_SECURE=true` and `COOKIE_SAMESITE=lax`
- Clear browser cookies and try again

### Database Connection Fails
- Verify `DATABASE_URL` is set correctly
- For DigitalOcean Managed PostgreSQL: Use connection string with `?sslmode=require`
- For Neon: Ensure using the **pooled** connection string (with `-pooler` in hostname)

### Frontend Can't Reach API
- Verify `NEXT_PUBLIC_API_URL` is set to `https://YOUR-APP-URL.ondigitalocean.app/api/v1`
- Redeploy frontend after setting this variable

---

## Estimated Costs

| Resource | Monthly Cost |
|----------|-------------|
| API Service | ~$5 |
| Web Service | ~$5 |
| **Total** | **~$10/month** |

With DigitalOcean student credits, this is **free for ~12 months**.
