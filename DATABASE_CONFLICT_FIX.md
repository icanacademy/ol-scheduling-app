# Database Conflict - Permanent Fix

## The Problem

Your Mac has **TWO PostgreSQL databases** installed:

1. **Homebrew PostgreSQL** (local installation)
   - Location: `/opt/homebrew/var/postgresql@15`
   - Has less data (645 teachers)
   - Should NOT be used for this app

2. **Docker PostgreSQL** (container)
   - Container name: `scheduling_db`
   - Has complete data (911 teachers, 792 students, 2,469 assignments)
   - **THIS IS THE ONE TO USE**

When both try to run at the same time, they fight for port 5432 and cause connection errors.

## What Was Fixed

### 1. Updated `.env` Configuration
File: `/Users/icanacademy/scheduling-app/server/.env`
- Changed `DB_USER` from `icanacademy` to `postgres`
- Set `DB_PASSWORD` to `postgres`
- This matches the Docker PostgreSQL credentials

### 2. Enhanced Startup Script
File: `Start Scheduling App.command`
- Now automatically detects Homebrew PostgreSQL conflicts
- Stops Homebrew PostgreSQL if it's running
- Ensures Docker PostgreSQL starts correctly
- **Always use this script to launch the app**

### 3. Docker Auto-Start Enabled
- Docker container has `unless-stopped` restart policy
- Will automatically start when you reboot your Mac
- No manual intervention needed

### 4. Created Diagnostic Tool
File: `fix-database-conflict.sh`
- Run this anytime you have database issues
- Shows which PostgreSQL is running
- Offers to fix configuration problems
- Verifies everything is set up correctly

## How to Prevent Conflicts

### ✅ DO THIS:
1. **Always** use `Start Scheduling App.command` to launch the app
2. Let Docker PostgreSQL auto-start on boot
3. Keep Homebrew PostgreSQL stopped
4. If you get errors, run `./fix-database-conflict.sh`

### ❌ DON'T DO THIS:
1. Don't manually start Homebrew PostgreSQL (`brew services start postgresql@15`)
2. Don't use `psql` without specifying the Docker container
3. Don't modify the `.env` file back to `DB_USER=icanacademy`

## Quick Troubleshooting

### If you restart your Mac and get database errors:

```bash
# Option 1: Use the startup script (recommended)
open "Start Scheduling App.command"

# Option 2: Run the diagnostic tool
./fix-database-conflict.sh

# Option 3: Manually check/fix
# Stop Homebrew PostgreSQL
brew services stop postgresql@15

# Start Docker PostgreSQL
docker compose up -d

# Restart the app
open "Start Scheduling App.command"
```

### Check which PostgreSQL is running:

```bash
# See what's on port 5432
lsof -i :5432

# If you see "/opt/homebrew" in the output = Homebrew (WRONG)
# If you see "docker" in the output = Docker (CORRECT)
```

### Verify database has data:

```bash
# Check Docker database
docker exec scheduling_db psql -U postgres -d scheduling_db -c "SELECT COUNT(*) FROM teachers;"
# Should show: 911

# Or use the diagnostic tool
./fix-database-conflict.sh
```

## Why This Keeps Happening

Some other application on your Mac might be auto-starting Homebrew PostgreSQL. Common culprits:

- TablePlus or other database GUIs
- Other development projects
- System scripts
- LaunchAgents/LaunchDaemons

The enhanced `Start Scheduling App.command` script now handles this automatically by:
1. Detecting the conflict
2. Stopping Homebrew PostgreSQL
3. Ensuring Docker PostgreSQL is running

## Files Modified

1. `/Users/icanacademy/scheduling-app/server/.env` - Database credentials
2. `/Users/icanacademy/scheduling-app/Start Scheduling App.command` - Auto-conflict resolution
3. `/Users/icanacademy/scheduling-app/server/src/db/connection.js` - Fallback defaults

## Files Created

1. `fix-database-conflict.sh` - Diagnostic and repair tool
2. `DATABASE_CONFLICT_FIX.md` - This documentation

---

**Last Updated:** November 11, 2025
**Status:** ✅ Permanent fix in place
**Action Required:** Just use the `Start Scheduling App.command` script
