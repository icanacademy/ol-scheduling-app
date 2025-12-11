#!/bin/bash
# Daily backup script for ICAN Scheduling App
# This script should be run via cron daily at 2 AM

# Change to the server directory
cd "$(dirname "$0")"

# Run the backup script
./backup.sh >> ./backups/daily-backup.log 2>&1

# Log completion
echo "$(date): Daily backup completed" >> ./backups/daily-backup.log
