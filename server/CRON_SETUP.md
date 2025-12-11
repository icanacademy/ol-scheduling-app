# Daily Automatic Backup Setup

This guide will help you set up automatic daily backups at 2 AM.

## Quick Setup

1. Open your crontab editor:
```bash
crontab -e
```

2. Add this line to run daily backups at 2 AM:
```
0 2 * * * cd /Users/icanacademy/scheduling-app/server && ./daily-backup.sh
```

3. Save and exit the editor
   - If using vim: Press `ESC`, then type `:wq` and press `ENTER`
   - If using nano: Press `CTRL+X`, then `Y`, then `ENTER`

## Verify Setup

Check that your cron job was added:
```bash
crontab -l
```

You should see your backup line in the output.

## Check Backup Logs

Backup logs are stored in:
```
/Users/icanacademy/scheduling-app/server/backups/daily-backup.log
```

View recent backup activity:
```bash
tail -20 /Users/icanacademy/scheduling-app/server/backups/daily-backup.log
```

## Manual Test

Test the daily backup script manually:
```bash
cd /Users/icanacademy/scheduling-app/server
./daily-backup.sh
```

## Backup Schedule

- **Time:** 2:00 AM every day
- **Retention:** ALL backups are kept indefinitely (no automatic deletion)
- **Locations:**
  - Primary: `/Users/icanacademy/scheduling-app/server/backups/`
  - Secondary: `/Users/icanacademy/Desktop/ICAN_Backups/`

## Troubleshooting

### Cron job not running?

1. Check if cron service is running:
```bash
ps aux | grep cron
```

2. Check system logs:
```bash
tail -f /var/log/system.log | grep cron
```

3. Make sure the script has execute permissions:
```bash
chmod +x /Users/icanacademy/scheduling-app/server/daily-backup.sh
chmod +x /Users/icanacademy/scheduling-app/server/backup.sh
```

### Grant Full Disk Access to cron (macOS)

On macOS, you may need to grant cron Full Disk Access:

1. Go to **System Preferences** > **Security & Privacy** > **Privacy**
2. Select **Full Disk Access** from the left sidebar
3. Click the lock icon and enter your password
4. Click the **+** button
5. Navigate to `/usr/sbin/cron` and add it
6. Restart your computer

## Disable Automatic Backups

To stop automatic daily backups:

1. Open crontab:
```bash
crontab -e
```

2. Delete or comment out the backup line (add `#` at the beginning)

3. Save and exit

## Alternative: Using launchd (macOS Recommended)

For more reliable scheduling on macOS, you can use launchd instead of cron.

Create a plist file at:
`~/Library/LaunchAgents/com.ican.scheduling.backup.plist`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.ican.scheduling.backup</string>
    <key>ProgramArguments</key>
    <array>
        <string>/Users/icanacademy/scheduling-app/server/daily-backup.sh</string>
    </array>
    <key>StartCalendarInterval</key>
    <dict>
        <key>Hour</key>
        <integer>2</integer>
        <key>Minute</key>
        <integer>0</integer>
    </dict>
    <key>StandardOutPath</key>
    <string>/Users/icanacademy/scheduling-app/server/backups/daily-backup.log</string>
    <key>StandardErrorPath</key>
    <string>/Users/icanacademy/scheduling-app/server/backups/daily-backup-error.log</string>
</dict>
</plist>
```

Then load it:
```bash
launchctl load ~/Library/LaunchAgents/com.ican.scheduling.backup.plist
```

To unload:
```bash
launchctl unload ~/Library/LaunchAgents/com.ican.scheduling.backup.plist
```
