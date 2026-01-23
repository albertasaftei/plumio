#!/bin/sh
# Pluma Automated Backup Script
# Runs inside Alpine container with cron

set -e

BACKUP_DIR="/backups"
DATA_DIR="/data"
RETENTION_DAYS="${BACKUP_RETENTION:-7}"
SCHEDULE="${BACKUP_SCHEDULE:-0 2 * * *}"

echo "🔄 Pluma Backup Service Starting..."
echo "  Backup directory: $BACKUP_DIR"
echo "  Data directory: $DATA_DIR"
echo "  Retention: $RETENTION_DAYS days"
echo "  Schedule: $SCHEDULE"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Function to perform backup
do_backup() {
    TIMESTAMP=$(date +%Y%m%d-%H%M%S)
    BACKUP_FILE="$BACKUP_DIR/pluma-backup-$TIMESTAMP.tar.gz"
    
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting backup..."
    
    # Create compressed backup
    if tar czf "$BACKUP_FILE" -C "$DATA_DIR" .; then
        BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✓ Backup created: $BACKUP_FILE ($BACKUP_SIZE)"
        
        # Clean up old backups
        DELETED_COUNT=$(find "$BACKUP_DIR" -name "pluma-backup-*.tar.gz" -type f -mtime +$RETENTION_DAYS -delete -print | wc -l)
        if [ "$DELETED_COUNT" -gt 0 ]; then
            echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✓ Cleaned up $DELETED_COUNT old backup(s)"
        fi
        
        # List current backups
        BACKUP_COUNT=$(find "$BACKUP_DIR" -name "pluma-backup-*.tar.gz" -type f | wc -l)
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Current backups: $BACKUP_COUNT"
        
        return 0
    else
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✗ Backup failed!"
        return 1
    fi
}

# Run initial backup immediately
echo ""
echo "Running initial backup..."
do_backup

# Setup cron job
echo ""
echo "Setting up cron job: $SCHEDULE"
echo "$SCHEDULE cd / && /backup.sh run-backup >> /var/log/backup.log 2>&1" | crontab -

# If called with run-backup argument, just do backup (for cron)
if [ "$1" = "run-backup" ]; then
    do_backup
    exit $?
fi

# Create log file
touch /var/log/backup.log

# Start cron in foreground and tail the log
echo "✓ Backup service started"
echo "  Logs will appear below..."
echo ""

crond -f -l 2 &
tail -f /var/log/backup.log
