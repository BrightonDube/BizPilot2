# 🗄️ Database Setup Guide

You have two options for the database:

## Option 1: Free Cloud Database (Recommended - No Install Needed)

### Using Neon.tech (Free PostgreSQL)

1. **Go to** [https://neon.tech](https://neon.tech)
2. **Sign up** with GitHub (takes 30 seconds)
3. **Create a new project**:
   - Name: `BizPilot`
   - Region: Choose closest to you
   - PostgreSQL version: 16
4. **Copy the connection string**:
   - It looks like: `postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/neondb`
5. **Update `backend\.env`**:
   ```
   DATABASE_URL=postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```

✅ Done! Your database is ready.

### Alternative: Supabase (Free PostgreSQL)

1. Go to [https://supabase.com](https://supabase.com)
2. Sign up and create a new project
3. Go to Settings → Database
4. Copy the "Connection string" (URI format)
5. Update `backend\.env` with this URL

## Option 2: Local PostgreSQL

### Install PostgreSQL

1. **Download**: [PostgreSQL 16 for Windows](https://www.postgresql.org/download/windows/)
2. **Run installer** as Administrator
3. **Set password**: Use `postgres` (for development)
4. **Port**: Keep default (5432)
5. **Install pgAdmin** (optional - GUI tool)

### Create Database

**Option A: Using pgAdmin**
1. Open pgAdmin
2. Right-click "Databases" → Create → Database
3. Name: `bizpilot`
4. Save

**Option B: Using psql (command line)**
```powershell
# Open PowerShell as Administrator
psql -U postgres
# Enter password: postgres

# In psql prompt:
CREATE DATABASE bizpilot;
\q
```

### Update Environment

The `backend\.env` file is already configured for local PostgreSQL:
```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/bizpilot
```

## Verify Database Connection

After setting up the database, test the connection:

```powershell
cd backend
python -m alembic upgrade head
```

If successful, you'll see:
```
INFO  [alembic.runtime.migration] Running upgrade ...
```

## Troubleshooting

### Connection refused
- Make sure PostgreSQL is running
- Check the DATABASE_URL is correct
- For cloud databases, ensure SSL mode: `?sslmode=require`

### Authentication failed
- Verify username and password in DATABASE_URL
- For local: default is `postgres:postgres`

### Database does not exist
- Create the database first (see above)
- Check database name matches in URL

---

**Next Step**: Run `.\start-local.ps1` to start the application!
