# Database Backup & Restore Guide

## Quick Start

### Create a Backup
```bash
cd /Users/edward/scheduling-app/server
./backup.sh
```

This creates a timestamped backup file in `backups/` directory (e.g., `backup_20251015_143022.sql`)

### Restore from a Backup
```bash
./restore.sh backups/backup_20251015_143022.sql
```

**⚠️ Warning:** Restoring will replace ALL current data!

## Backup Recommendations

### Daily Backups (Before Making Changes)
Before adding teachers, students, or making any major changes:
```bash
./backup.sh
```

### Before Schema Changes
**ALWAYS** backup before running schema.sql or making database structure changes:
```bash
./backup.sh
# Wait for confirmation
# Then make your changes
```

### Automated Daily Backups (Optional)
Add this to your crontab to backup daily at 2 AM:
```bash
# Edit crontab
crontab -e

# Add this line:
0 2 * * * cd /Users/edward/scheduling-app/server && ./backup.sh >> backups/backup.log 2>&1
```

## Backup Features

- **Automatic timestamping:** Each backup has a unique timestamp
- **Automatic cleanup:** Keeps only the last 10 backups (configurable)
- **Safe restore:** Asks for confirmation before overwriting data
- **Size reporting:** Shows backup file size

## What Gets Backed Up?

- All teachers (with availability and dates)
- All students (with availability, weakness levels, notes, and dates)
- All assignments (with teacher/student pairings)
- All rooms
- All time slots

## Manual Backup/Restore (Alternative)

If the scripts don't work, use these direct commands:

**Backup:**
```bash
/usr/local/opt/postgresql@16/bin/pg_dump -U edward scheduling_db > my_backup.sql
```

**Restore:**
```bash
/usr/local/opt/postgresql@16/bin/psql -U edward -d scheduling_db < my_backup.sql
```

## Troubleshooting

### "Permission denied" when running scripts
```bash
chmod +x backup.sh restore.sh
```

### "psql: command not found"
Your PostgreSQL installation path might be different. Find it with:
```bash
which psql
# Or
brew --prefix postgresql@16
```

### Check available backups
```bash
ls -lh backups/
```

## Best Practices

1. **Backup before important changes** - Always backup before modifying the database structure
2. **Keep multiple backups** - Don't rely on just one backup file
3. **Test restores** - Occasionally test that your backups can be restored
4. **External backups** - Consider copying backup files to cloud storage or external drive
5. **Backup before deployments** - Always backup before deploying new code

## Emergency Recovery

If you accidentally deleted data:

1. **Don't panic!** If you have a backup, you can restore it
2. **List available backups:**
   ```bash
   ./restore.sh
   ```
3. **Choose the most recent backup before the data loss**
4. **Restore:**
   ```bash
   ./restore.sh backups/backup_YYYYMMDD_HHMMSS.sql
   ```

## Storage Location

Backups are stored in: `/Users/edward/scheduling-app/server/backups/`

The backups directory is excluded from git (added to .gitignore) to avoid committing sensitive data.
