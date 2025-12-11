#!/bin/bash

# Scheduling App Database Backup Script
# Creates timestamped backups in the backups directory

# Configuration
DB_USER="icanacademy"
DB_NAME="scheduling_db"
BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/backup_${TIMESTAMP}.sql"

# Create backups directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Create backup with --clean and --if-exists flags for safe restoration
echo "Creating backup: $BACKUP_FILE"
/opt/homebrew/opt/postgresql@15/bin/pg_dump -U "$DB_USER" --clean --if-exists "$DB_NAME" > "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    echo "✓ Backup created successfully!"
    echo "File: $BACKUP_FILE"

    # Show backup size
    SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo "Size: $SIZE"

    # Copy to second backup location (Desktop)
    DESKTOP_BACKUP_DIR="$HOME/Desktop/ICAN_Backups"
    mkdir -p "$DESKTOP_BACKUP_DIR"
    cp "$BACKUP_FILE" "$DESKTOP_BACKUP_DIR/"

    if [ $? -eq 0 ]; then
        echo "✓ Backup copied to Desktop: $DESKTOP_BACKUP_DIR/"
    else
        echo "⚠ Warning: Failed to copy backup to Desktop"
    fi

    # Show backup counts in both locations
    echo ""
    echo "Backup locations:"
    MAIN_COUNT=$(ls "$BACKUP_DIR"/backup_*.sql 2>/dev/null | wc -l)
    DESKTOP_COUNT=$(ls "$DESKTOP_BACKUP_DIR"/backup_*.sql 2>/dev/null | wc -l)
    echo "  Main: $BACKUP_DIR ($MAIN_COUNT backups)"
    echo "  Desktop: $DESKTOP_BACKUP_DIR ($DESKTOP_COUNT backups)"
else
    echo "✗ Backup failed!"
    exit 1
fi
