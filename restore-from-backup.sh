#!/bin/bash

# SQL Backup Restore Script
# Restores database from SQL backup files

set -e

echo "========================================="
echo "ICAN Scheduler - Database Restore"
echo "========================================="
echo ""

# Configuration
DB_USER="icanacademy"
DB_NAME="scheduling_db"
PSQL_PATH="/opt/homebrew/opt/postgresql@15/bin/psql"

# Backup locations
BACKUP_DIR1="/Users/icanacademy/scheduling-app/server/backups"
BACKUP_DIR2="$HOME/Desktop/ICAN_Backups"

# Function to list backups
list_backups() {
    local dir=$1
    local location=$2

    if [ ! -d "$dir" ]; then
        return
    fi

    echo ""
    echo "📁 $location:"
    echo "----------------------------------------"

    local count=1
    for backup in $(ls -t "$dir"/backup_*.sql 2>/dev/null); do
        local filename=$(basename "$backup")
        local size=$(du -h "$backup" | cut -f1)
        local date=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M" "$backup")

        printf "%2d) %s\n" $count "$filename"
        printf "    Date: %s | Size: %s\n" "$date" "$size"

        count=$((count + 1))

        # Only show first 10 from each location
        if [ $count -gt 10 ]; then
            local total=$(ls "$dir"/backup_*.sql 2>/dev/null | wc -l)
            echo "    ... and $((total - 10)) more backups"
            break
        fi
    done
}

# Show available backups
echo "Available Backups:"
list_backups "$BACKUP_DIR1" "Server Location"
list_backups "$BACKUP_DIR2" "Desktop Location"

echo ""
echo "========================================="
echo ""

# Ask for backup file
echo "Enter the FULL filename of the backup to restore:"
echo "Example: backup_2025-10-21T05-07-53.sql"
echo ""
read -p "Filename: " backup_filename

# Find the backup file
BACKUP_FILE=""
if [ -f "$BACKUP_DIR1/$backup_filename" ]; then
    BACKUP_FILE="$BACKUP_DIR1/$backup_filename"
    echo "✓ Found in server location"
elif [ -f "$BACKUP_DIR2/$backup_filename" ]; then
    BACKUP_FILE="$BACKUP_DIR2/$backup_filename"
    echo "✓ Found on Desktop"
else
    echo "❌ Error: Backup file '$backup_filename' not found!"
    echo ""
    echo "Please check the filename and try again."
    exit 1
fi

# Show backup info
echo ""
echo "========================================="
echo "Backup Information:"
echo "========================================="
echo "File: $backup_filename"
echo "Location: $BACKUP_FILE"
echo "Size: $(du -h "$BACKUP_FILE" | cut -f1)"
echo "Created: $(stat -f "%Sm" -t "%Y-%m-%d %H:%M:%S" "$BACKUP_FILE")"
echo ""

# Count current database records
echo "Current database contents:"
CURRENT_TEACHERS=$(psql -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM teachers;" 2>/dev/null || echo "0")
CURRENT_STUDENTS=$(psql -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM students;" 2>/dev/null || echo "0")
CURRENT_ASSIGNMENTS=$(psql -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM assignments;" 2>/dev/null || echo "0")

echo "  Teachers: $CURRENT_TEACHERS"
echo "  Students: $CURRENT_STUDENTS"
echo "  Assignments: $CURRENT_ASSIGNMENTS"
echo ""

# Final confirmation
echo "⚠️  WARNING: This will REPLACE all current data!"
echo ""
read -p "Are you sure you want to restore from this backup? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo ""
    echo "Restore cancelled."
    exit 0
fi

# Perform restore
echo ""
echo "========================================="
echo "Restoring database..."
echo "========================================="
echo ""

# Create a safety backup before restore
SAFETY_BACKUP="/tmp/pre_restore_backup_$(date +%Y%m%d_%H%M%S).sql"
echo "1. Creating safety backup..."
/opt/homebrew/opt/postgresql@15/bin/pg_dump -U "$DB_USER" --clean --if-exists "$DB_NAME" > "$SAFETY_BACKUP" 2>/dev/null || true
echo "   Safety backup: $SAFETY_BACKUP"

# Restore from backup
echo ""
echo "2. Restoring from backup..."
"$PSQL_PATH" -U "$DB_USER" -d "$DB_NAME" -f "$BACKUP_FILE" > /dev/null 2>&1

if [ $? -eq 0 ]; then
    echo "   ✓ Restore completed successfully!"
else
    echo "   ❌ Restore failed!"
    echo ""
    echo "You can recover from the safety backup at:"
    echo "$SAFETY_BACKUP"
    exit 1
fi

# Verify restore
echo ""
echo "3. Verifying restored data..."
NEW_TEACHERS=$(psql -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM teachers;")
NEW_STUDENTS=$(psql -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM students;")
NEW_ASSIGNMENTS=$(psql -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM assignments;")

echo ""
echo "========================================="
echo "Restore Complete!"
echo "========================================="
echo ""
echo "Restored data:"
echo "  Teachers: $NEW_TEACHERS"
echo "  Students: $NEW_STUDENTS"
echo "  Assignments: $NEW_ASSIGNMENTS"
echo ""
echo "Your database has been restored to:"
echo "  $backup_filename"
echo ""
echo "Safety backup saved at:"
echo "  $SAFETY_BACKUP"
echo ""
echo "You can now use your application!"
echo ""
