#!/bin/bash

# Scheduling App Database Restore Script
# Restores database from a backup file

# Configuration
DB_USER="icanacademy"
DB_NAME="scheduling_db"
BACKUP_DIR="./backups"

# Check if backup file is provided
if [ -z "$1" ]; then
    echo "Usage: ./restore.sh <backup_file>"
    echo ""
    echo "Available backups:"
    ls -lh "$BACKUP_DIR"/backup_*.sql 2>/dev/null || echo "No backups found"
    echo ""
    echo "Example: ./restore.sh backups/backup_20251015_143022.sql"
    exit 1
fi

BACKUP_FILE="$1"

# Check if file exists
if [ ! -f "$BACKUP_FILE" ]; then
    echo "✗ Error: Backup file not found: $BACKUP_FILE"
    exit 1
fi

# Confirm before restoring
echo "⚠️  WARNING: This will replace ALL current data in the database!"
echo "Backup file: $BACKUP_FILE"
echo ""
read -p "Are you sure you want to continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Restore cancelled."
    exit 0
fi

# Restore the backup
echo ""
echo "Restoring database from: $BACKUP_FILE"
/opt/homebrew/opt/postgresql@15/bin/psql -U "$DB_USER" -d "$DB_NAME" < "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    echo ""
    echo "✓ Database restored successfully!"
else
    echo ""
    echo "✗ Restore failed!"
    exit 1
fi
