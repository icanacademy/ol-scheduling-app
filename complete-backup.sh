#!/bin/bash

# Complete System Backup Script
# Backs up BOTH the application AND the database to restore complete state

set -e  # Exit on any error

# Configuration
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_ROOT="$HOME/Desktop/ICAN_Complete_Backups"
BACKUP_DIR="${BACKUP_ROOT}/backup_${TIMESTAMP}"

APP_DIR="/Users/icanacademy/scheduling-app"
POSTGRES_DIR="/opt/homebrew/var/postgresql@15"

echo "========================================="
echo "ICAN Scheduler - Complete Backup"
echo "========================================="
echo ""
echo "Timestamp: $(date)"
echo "Backup location: $BACKUP_DIR"
echo ""

# Create backup directory structure
echo "📁 Creating backup directory..."
mkdir -p "$BACKUP_DIR"

# Stop PostgreSQL temporarily for clean backup
echo "⏸️  Stopping PostgreSQL..."
brew services stop postgresql@15
sleep 2

# Backup PostgreSQL data directory
echo "💾 Backing up PostgreSQL database (71 MB)..."
cp -R "$POSTGRES_DIR" "$BACKUP_DIR/postgresql_data"

# Restart PostgreSQL
echo "▶️  Restarting PostgreSQL..."
brew services start postgresql@15
sleep 2

# Backup application directory
echo "📦 Backing up application files..."
cp -R "$APP_DIR" "$BACKUP_DIR/scheduling-app"

# Create a README in the backup
cat > "$BACKUP_DIR/README.txt" << EOF
ICAN Scheduler - Complete Backup
Created: $(date)

This backup contains:
1. Application code and files
2. Complete PostgreSQL database

To restore:
1. Run: ./restore.sh
   OR
2. Stop PostgreSQL: brew services stop postgresql@15
3. Copy postgresql_data back to: /opt/homebrew/var/postgresql@15
4. Copy scheduling-app back to: /Users/icanacademy/
5. Start PostgreSQL: brew services start postgresql@15

IMPORTANT: Restoring will REPLACE current data!
EOF

# Create restore script
cat > "$BACKUP_DIR/restore.sh" << 'EOF'
#!/bin/bash

echo "⚠️  WARNING: This will restore your system to the backed up state"
echo "Current data will be REPLACED!"
echo ""
read -p "Continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Restore cancelled."
    exit 0
fi

BACKUP_DIR="$(cd "$(dirname "$0")" && pwd)"

echo ""
echo "Stopping PostgreSQL..."
brew services stop postgresql@15
sleep 2

echo "Restoring PostgreSQL database..."
rm -rf /opt/homebrew/var/postgresql@15
cp -R "$BACKUP_DIR/postgresql_data" /opt/homebrew/var/postgresql@15

echo "Restoring application files..."
rm -rf /Users/icanacademy/scheduling-app
cp -R "$BACKUP_DIR/scheduling-app" /Users/icanacademy/

echo "Starting PostgreSQL..."
brew services start postgresql@15
sleep 3

echo ""
echo "✅ Restore complete!"
echo "Your system has been restored to: $(cat README.txt | grep Created)"
EOF

chmod +x "$BACKUP_DIR/restore.sh"

# Calculate backup size
BACKUP_SIZE=$(du -sh "$BACKUP_DIR" | cut -f1)

echo ""
echo "✅ Complete backup created successfully!"
echo ""
echo "========================================="
echo "Backup Summary"
echo "========================================="
echo "Location: $BACKUP_DIR"
echo "Size: $BACKUP_SIZE"
echo ""
echo "Contents:"
echo "  ✓ Application files"
echo "  ✓ PostgreSQL database"
echo "  ✓ Restore script included"
echo ""
echo "To restore this backup:"
echo "  cd '$BACKUP_DIR'"
echo "  ./restore.sh"
echo ""

# Count total backups (no automatic deletion)
REMAINING=$(ls -t "$BACKUP_ROOT" | grep "backup_" | wc -l)
TOTAL_SIZE=$(du -sh "$BACKUP_ROOT" | cut -f1)
echo "📊 Backup Statistics:"
echo "  Total complete backups: $REMAINING"
echo "  Total size: $TOTAL_SIZE"
echo "  All backups are kept indefinitely (no auto-deletion)"
echo ""
