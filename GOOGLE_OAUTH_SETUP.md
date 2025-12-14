# 🔐 Google OAuth Setup Guide

This guide will help you set up Google OAuth for BizPilot in 5 minutes.

## Step 1: Create Google Cloud Project

1. Go to **[Google Cloud Console](https://console.cloud.google.com)**
2. Click **"Select a project"** → **"New Project"**
3. **Project name**: `BizPilot` (or any name you like)
4. Click **"Create"**
5. Wait for the project to be created (10 seconds)
6. Make sure your new project is selected in the top dropdown

## Step 2: Enable Google+ API

1. In the left sidebar, click **"APIs & Services"** → **"Library"**
2. Search for: `Google+ API`
3. Click on **"Google+ API"**
4. Click **"Enable"**
5. Wait for it to enable (5 seconds)

## Step 3: Configure OAuth Consent Screen

1. In the left sidebar, click **"OAuth consent screen"**
2. Choose **"External"** (allows anyone with a Google account)
3. Click **"Create"**

**Fill in the form:**

- **App name**: `BizPilot`
- **User support email**: Your email address
- **App logo**: (optional - skip for now)
- **App domain**: (skip for development)
- **Authorized domains**: (leave empty for development)
- **Developer contact email**: Your email address

4. Click **"Save and Continue"**

**Scopes:**
5. Click **"Add or Remove Scopes"**
6. Select these scopes:
   - ✅ `.../auth/userinfo.email`
   - ✅ `.../auth/userinfo.profile`
   - ✅ `openid`
7. Click **"Update"**
8. Click **"Save and Continue"**

**Test Users (for development):**
9. Click **"Add Users"**
10. Add your email address
11. Click **"Save and Continue"**
12. Click **"Back to Dashboard"**

## Step 4: Create OAuth Credentials

1. In the left sidebar, click **"Credentials"**
2. Click **"Create Credentials"** → **"OAuth client ID"**
3. **Application type**: Select **"Web application"**
4. **Name**: `BizPilot Local Development`

### 🎯 IMPORTANT - URLs for Local Development:

**Authorized JavaScript origins** (add these):
```
http://localhost:3000
http://localhost:8000
```

**Authorized redirect URIs** (add these):
```
http://localhost:8000/api/v1/oauth/google/callback
http://localhost:3000/api/auth/callback/google
```

5. Click **"Create"**
6. A popup will show your credentials:
   - **Client ID**: Something like `123456789-abc...xyz.apps.googleusercontent.com`
   - **Client Secret**: Something like `GOCSPX-abc...xyz`
7. **Copy both** - you'll need them!

## Step 5: Update Environment Variables

### Backend (.env)

Open `backend\.env` and update:

```env
# Google OAuth
GOOGLE_CLIENT_ID=YOUR_CLIENT_ID_HERE
GOOGLE_CLIENT_SECRET=YOUR_CLIENT_SECRET_HERE
```

### Frontend (.env.local)

Open `frontend\.env.local` and update:

```env
# Google OAuth
GOOGLE_CLIENT_ID=YOUR_CLIENT_ID_HERE
GOOGLE_CLIENT_SECRET=YOUR_CLIENT_SECRET_HERE
```

**⚠️ IMPORTANT**: Use the **same credentials** in both files!

## Step 6: Test OAuth

1. Start your application:
   ```powershell
   .\start-local.ps1
   ```

2. Open browser: `http://localhost:3000`

3. Click **"Sign in with Google"**

4. You should see:
   - Google login screen
   - "This app isn't verified" warning (normal for development)
   - Click **"Advanced"** → **"Go to BizPilot (unsafe)"**
   - Select your Google account
   - Success! You're logged in

## 🎉 Done!

You can now:
- ✅ Sign in with Google
- ✅ Register new users with Google
- ✅ Use email/password authentication (still works)

---

## 🚀 For Production Deployment (Render.com)

When deploying to production, update the URLs:

**Authorized JavaScript origins:**
```
https://bizpilot-web.onrender.com
https://bizpilot-api.onrender.com
```

**Authorized redirect URIs:**
```
https://bizpilot-api.onrender.com/api/v1/oauth/google/callback
https://bizpilot-web.onrender.com/api/auth/callback/google
```

Then update the environment variables in Render dashboard with the same credentials.

---

## 🔧 Troubleshooting

### "redirect_uri_mismatch" error
- ✅ Check URLs match exactly (no trailing slashes)
- ✅ Make sure you added both redirect URIs
- ✅ Wait 5 minutes after adding URIs (Google caches)

### "This app isn't verified"
- ✅ Normal for development
- ✅ Click "Advanced" → "Go to BizPilot (unsafe)"
- ✅ For production, submit app for verification

### OAuth not working
- ✅ Check Client ID and Secret are correct
- ✅ Make sure they match in backend and frontend
- ✅ Restart application after updating .env files

### "Access blocked: BizPilot has not completed..."
- ✅ Make sure you added yourself as a test user
- ✅ Or publish the app (make it public)

---

## 📝 Quick Reference

**Google Cloud Console**: https://console.cloud.google.com

**Required Scopes:**
- userinfo.email
- userinfo.profile  
- openid

**Local URLs:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- Callback: http://localhost:8000/api/v1/oauth/google/callback

**Environment Files:**
- Backend: `backend\.env`
- Frontend: `frontend\.env.local`

---

Happy OAuth! 🎊
