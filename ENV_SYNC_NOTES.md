# Environment Variables Sync from DigitalOcean

**Synced on:** 2026-01-24  
**Source:** DigitalOcean App Platform (bizpilot app)

## ✅ Successfully Synced Variables

### Backend (`backend/.env`)
- ✅ SMTP Configuration (Brevo/Sendinblue)
  - Host: smtp-relay.brevo.com
  - Port: 587
  - User: a00cd8001@smtp-brevo.com
  - Password: R29SnVdwPsFDCmEa
- ✅ Google OAuth Credentials
- ✅ Groq API Key (AI Assistant)
- ✅ Paystack Payment Keys (Test mode)
- ✅ Superadmin Password: `6y%2Eb!D4u`
- ✅ JWT Configuration
- ✅ CORS Origins (adjusted for localhost)

### Frontend (`frontend/.env`)
- ✅ Google OAuth Client ID
- ✅ API URLs (adjusted for localhost)
- ✅ Node Environment

## ⚠️ Encrypted Variables (Need Manual Setup)

These variables are encrypted in DigitalOcean and cannot be automatically retrieved:

### 1. **SECRET_KEY** (Backend JWT Secret)
- **Status:** Using local development key
- **Production:** Encrypted in DigitalOcean
- **Action:** If you need the exact production key, get it from DigitalOcean dashboard
- **Current:** Using safe local development key

### 2. **DATABASE_URL** (PostgreSQL Connection)
- **Status:** Using local PostgreSQL (production DB is IP-restricted)
- **Production:** Encrypted in DigitalOcean + IP whitelisting enabled
- **Current:** `postgresql://postgres:postgres@localhost:5432/bizpilot_dev`
- **Issue:** Production database at `bizpilot-postgres-do-user-30635323-0.m.db.ondigitalocean.com:25060` is not accessible from localhost due to firewall/IP restrictions
- **Action:** 
  - **Option 1 (Recommended):** Use local PostgreSQL for development
    ```bash
    # Install PostgreSQL if not already installed
    # Create local database
    createdb bizpilot_dev
    
    # Run migrations
    cd backend
    python -m alembic upgrade head
    
    # Seed with test data (optional)
    python scripts/direct_seed.py
    ```
  - **Option 2:** Add your IP to DigitalOcean database firewall (not recommended for security)
  - **Option 3:** Use SSH tunnel through a DigitalOcean droplet (advanced)

### 3. **GOOGLE_CLIENT_SECRET**
- **Status:** Using existing value from your config
- **Production:** Encrypted in DigitalOcean
- **Current:** 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

## 🔧 Configuration Adjustments for Localhost

The following values were adjusted for local development:

1. **CORS_ORIGINS:** Changed to localhost URLs
2. **COOKIE_DOMAIN:** Empty (for localhost)
3. **COOKIE_SECURE:** false (localhost uses HTTP)
4. **FRONTEND_URL:** http://localhost:3000
5. **NEXT_PUBLIC_API_URL:** http://localhost:8000/api/v1
6. **DEBUG:** true (for development)
7. **ENVIRONMENT:** development

## 🚀 Next Steps

1. **Start PostgreSQL locally** (if not already running):
   ```bash
   # Make sure PostgreSQL is running on localhost:5432
   ```

2. **Create local database**:
   ```bash
   createdb bizpilot_dev
   ```

3. **Run migrations**:
   ```bash
   cd backend
   python -m alembic upgrade head
   ```

4. **Start backend**:
   ```bash
   cd backend
   uvicorn app.main:app --reload --port 8000
   ```

5. **Start frontend**:
   ```bash
   cd frontend
   pnpm dev
   ```

## 🔐 Security Notes

- ✅ Email credentials are from production (Brevo)
- ✅ Payment keys are TEST mode (safe for development)
- ✅ OAuth credentials are shared (works for both prod and dev)
- ⚠️ Superadmin password is from production - use carefully
- ✅ Local SECRET_KEY is different from production (secure)

## 📝 Important Reminders

1. **Never commit `.env` files** - They're in `.gitignore`
2. **Production DATABASE_URL** - If you need it, get from DO dashboard
3. **Email testing** - Emails will be sent via production SMTP (Brevo)
4. **Payment testing** - Using test keys, no real charges will occur
5. **Google OAuth** - Will work with localhost:3000 redirect

## 🔍 How to Get Encrypted Values from DigitalOcean

If you need the actual production values:

1. Go to: https://cloud.digitalocean.com/apps
2. Click on "bizpilot" app
3. Go to "Settings" → "App-Level Environment Variables"
4. Click "Edit" next to the encrypted variable
5. Copy the decrypted value
6. Update your local `.env` file

## ✨ Your App Should Now Work!

With these environment variables, your localhost setup should:
- ✅ Connect to local PostgreSQL database
- ✅ Send real emails via Brevo
- ✅ Use Google OAuth for login
- ✅ Process test payments via Paystack
- ✅ Use AI features via Groq
- ✅ Match production configuration (except database)
