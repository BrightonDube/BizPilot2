# 🚀 BizPilot Local Deployment - Quick Reference

## ✅ Setup Complete!

All dependencies are installed and ready to go. You just need a database!

---

## 🗄️ Get a Free Database (2 minutes)

### Option 1: Neon.tech (Recommended)

1. Visit: **https://neon.tech**
2. Click "Sign Up" → Sign in with GitHub
3. Create a new project:
   - Name: `BizPilot`
   - Region: Choose closest to you
   - PostgreSQL: 16 (default)
4. **Copy the connection string** (looks like):
   ```
   postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/neondb
   ```

### Option 2: Supabase

1. Visit: **https://supabase.com**
2. Create account and new project
3. Go to Settings → Database → Connection string (URI)
4. Copy the connection string

---

## 📝 Update Database URL

### Easy Way (Use Helper Script):

```powershell
.\update-db-url.ps1 "your-database-url-here"
```

### Manual Way:

1. Open `backend\.env` in any text editor
2. Find the line:
   ```
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/bizpilot
   ```
3. Replace with your database URL:
   ```
   DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require
   ```
4. Save the file

---

## 🎯 Start the Application

```powershell
.\start-local.ps1
```

This script will:
- ✅ Run database migrations
- ✅ Start backend API on http://localhost:8000
- ✅ Start frontend on http://localhost:3000

**Wait 10-15 seconds** for services to start, then open your browser!

---

## 🌐 Access Your Application

| Service | URL | Description |
|---------|-----|-------------|
| **Frontend** | http://localhost:3000 | Main application |
| **Backend API** | http://localhost:8000 | API endpoint |
| **API Docs** | http://localhost:8000/docs | Interactive API documentation |

---

## 🛑 Stop the Application

Press `Ctrl+C` in the terminal where services are running.

---

## 📁 Files Created

| File | Purpose |
|------|---------|
| `backend\.env` | Backend configuration (secrets, database URL) |
| `frontend\.env.local` | Frontend configuration |
| `start-local.ps1` | One-command startup script |
| `update-db-url.ps1` | Helper to update database URL |
| `DATABASE_SETUP.md` | Detailed database setup instructions |
| `secrets.json` | Your generated secret keys (don't commit!) |

---

## 🔧 Troubleshooting

### Database connection error

**Error**: `could not connect to server`

**Fix**: Make sure:
- Database URL is correct in `backend\.env`
- Cloud databases have `?sslmode=require` at the end
- Your database service is running (check Neon/Supabase dashboard)

### Port already in use

**Error**: `Address already in use`

**Fix**:
```powershell
# Kill process on port 8000 (backend)
netstat -ano | findstr :8000
taskkill /PID <process-id> /F

# Kill process on port 3000 (frontend)
netstat -ano | findstr :3000
taskkill /PID <process-id> /F
```

### Migration errors

**Error**: `Target database is not up to date`

**Fix**:
```powershell
cd backend
python -m alembic upgrade head
cd ..
```

### Module not found errors

**Fix**: Reinstall dependencies:
```powershell
# Backend
cd backend
pip install -r requirements.txt
cd ..

# Frontend
cd frontend
pnpm install
cd ..
```

---

## 🎉 First Time Setup Checklist

- [ ] Got database URL from Neon.tech or Supabase
- [ ] Updated `backend\.env` with DATABASE_URL
- [ ] Ran `.\start-local.ps1`
- [ ] Waited for services to start (10-15 seconds)
- [ ] Opened http://localhost:3000 in browser
- [ ] Registered first user account

---

## 📞 Need Help?

1. Check `DATABASE_SETUP.md` for detailed database instructions
2. Check `DEPLOYMENT.md` for full deployment guide
3. Open an issue on GitHub
4. Check backend logs for specific errors

---

## 🚀 Next Steps

Once the app is running:

1. **Create an account** at http://localhost:3000/auth/register
2. **Log in** and create your first organization
3. **Explore the features**:
   - Products management
   - Inventory tracking
   - Customer management
   - Order processing
   - Invoice generation

---

**Happy business managing! 🎉**
