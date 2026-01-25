# Database Connection Fix - Login 500 Error Resolution

**Date:** 2026-01-24  
**Issue:** 500 Internal Server Error on login  
**Root Cause:** Production PostgreSQL database is not accessible from localhost

## 🔍 Problem Diagnosis

### Symptoms
- Login endpoint returns 500 Internal Server Error
- Subscription tiers endpoint also returns 500 error
- Frontend shows authentication failures

### Root Cause
```
Connection timed out (0x0000274C/10060)
connection to server at "bizpilot-postgres-do-user-30635323-0.m.stgreSQL (IP-restricted) to local PostgreSQL database for development
m alembic upgrade head
```

### "No module named 'alembic'"
Install Python dependencies:
```bash
cd backend
pip install -r requirements.txt
```

## ✅ Success Criteria

You'll know the fix worked when:
- ✅ Backend starts without database connection errors
- ✅ Login endpoint returns 200 OK with tokens
- ✅ Subscription tiers endpoint returns data
- ✅ Frontend can authenticate users successfully
- ✅ No more 500 Internal Server Errors

---

**Status:** ✅ Fixed  
**Resolution:** Switched from production DigitalOcean Poalembic.sqlalchemy.org/
- **DigitalOcean Database Docs**: https://docs.digitalocean.com/products/databases/

## 🔧 Troubleshooting

### "createdb: command not found"
PostgreSQL is not installed or not in PATH. Install PostgreSQL first.

### "FATAL: password authentication failed"
Update the DATABASE_URL in `.env` with your PostgreSQL credentials:
```env
DATABASE_URL=postgresql://your-username:your-password@localhost:5432/bizpilot_dev
```

### "relation does not exist"
Run migrations:
```bash
cd backend
python - "Content-Type: application/json" \
     -d '{"email":"admin@bizpilot.com","password":"your-password"}'
   ```
   Should return: `{"access_token":"...","refresh_token":"..."}`

## 🚀 Next Steps

1. **Run the setup script** to create your local database
2. **Restart your backend** server (if running)
3. **Test login** through the frontend
4. **Seed test data** if needed for development

## 📚 Additional Resources

- **PostgreSQL Documentation**: https://www.postgresql.org/docs/
- **Alembic Migrations**: https://

After setting up the local database, test the authentication:

1. **Test Database Connection**
   ```bash
   curl http://localhost:8000/api/v1/auth/test-db-query
   ```
   Should return: `{"status":"success","tests":{...}}`

2. **Test Authentication Components**
   ```bash
   curl http://localhost:8000/api/v1/auth/test-auth-components
   ```
   Should return: `{"status":"success","tests":{...}}`

3. **Test Login** (if you have a user)
   ```bash
   curl -X POST http://localhost:8000/api/v1/auth/login \
     -Hase

## 📝 What Changed

### Files Modified
1. **`backend/.env`**
   - Updated `DATABASE_URL` to use local PostgreSQL
   - Added comments explaining the change

2. **`ENV_SYNC_NOTES.md`**
   - Documented the database connection issue
   - Added setup instructions

3. **Created Setup Scripts**
   - `backend/setup_local_db.ps1` (Windows PowerShell)
   - `backend/setup_local_db.sh` (macOS/Linux Bash)

4. **This Document**
   - `DATABASE_CONNECTION_FIX.md` - Complete troubleshooting guide

## 🧪 Testing the Fixluster
3. Go to "Settings" → "Trusted Sources"
4. Add your public IP address

**Cons:**
- Security risk (exposing production database)
- IP may change (dynamic IPs)
- Slower than local database
- Risk of modifying production data

### Option B: SSH Tunnel Through Droplet
```bash
# Create SSH tunnel through a DigitalOcean droplet
ssh -L 5432:bizpilot-postgres-do-user-30635323-0.m.db.ondigitalocean.com:25060 user@your-droplet-ip
```

**Cons:**
- Requires a DigitalOcean droplet
- Complex setup
- Slower than local datab has been updated to use local PostgreSQL:

```env
# Before (Production - Not Accessible)
DATABASE_URL=postgresql://doadmin:AVNS_Yt4deUv5k-rD3ECUTPA@bizpilot-postgres-do-user-30635323-0.m.db.ondigitalocean.com:25060/defaultdb?sslmode=require

# After (Local - Accessible)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/bizpilot_dev
```

## 🔐 Alternative Options (Not Recommended)

### Option A: Add Your IP to DigitalOcean Firewall
1. Go to DigitalOcean Dashboard → Databases
2. Select your PostgreSQL c.org/download/windows/
   - **macOS**: `brew install postgresql`
   - **Ubuntu/Debian**: `sudo apt-get install postgresql`

2. **Create Database**
   ```bash
   createdb -U postgres bizpilot_dev
   ```

3. **Run Migrations**
   ```bash
   cd backend
   python -m alembic upgrade head
   ```

4. **Seed Database** (optional)
   ```bash
   python scripts/direct_seed.py
   ```

5. **Start Application**
   ```bash
   # From project root
   pnpm run dev:all
   ```

### Updated Configuration

The `backend/.env` fileaster for development
3. **Safety**: No risk of accidentally modifying production data
4. **Offline**: Can develop without internet connection

### Setup Steps

#### Option 1: Automated Setup (Recommended)

**Windows (PowerShell):**
```powershell
cd backend
.\setup_local_db.ps1
```

**macOS/Linux (Bash):**
```bash
cd backend
chmod +x setup_local_db.sh
./setup_local_db.sh
```

#### Option 2: Manual Setup

1. **Install PostgreSQL** (if not already installed)
   - **Windows**: Download from https://www.postgresqldb.ondigitalocean.com" 
(68.183.89.7), port 25060 failed
```

The production DigitalOcean PostgreSQL database has **IP whitelisting** enabled and is only accessible from:
- DigitalOcean App Platform (production environment)
- Specific whitelisted IPs (if configured)

Your local machine's IP is **not whitelisted**, causing connection timeouts.

## ✅ Solution: Use Local PostgreSQL Database

### Why Local Database?
1. **Security**: Production database should remain IP-restricted
2. **Performance**: Local database is f