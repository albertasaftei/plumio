# Backup System

Pluma includes an optional automated backup system that runs daily to protect your documents.

## Enabling Automated Backups

The backup service is **disabled by default**. To enable it, start the services with the `backup` profile:

```bash
# Start all services with automated backups enabled
docker-compose --profile backup up -d

# Or if services are already running, just start the backup service
docker-compose --profile backup up -d backup
```

To disable automated backups, simply stop the backup container:

```bash
docker-compose stop backup
```

## How It Works

- **Automatic Backups**: Every day at 2 AM, a backup is created
- **Retention Policy**: Backups older than 7 days are automatically deleted
- **Compression**: Backups are compressed using tar.gz to save space
- **Initial Backup**: A backup is created immediately when the container starts

## Backup Location

Backups are stored in the `./backups/` directory with filenames like:

```
pluma-backup-20260123-141008.tar.gz
```

Format: `pluma-backup-YYYYMMDD-HHMMSS.tar.gz`

## Manual Backup

Create a backup manually at any time:

```bash
docker exec pluma-backup /backup.sh run-backup
```

## View Backup Logs

Check what backups have been created and when:

```bash
docker logs pluma-backup
```

Or follow logs in real-time:

```bash
docker logs -f pluma-backup
```

## Restore from Backup

To restore documents from a backup:

1. Stop the backend container:

   ```bash
   docker-compose stop backend
   ```

2. Extract the backup to the data volume:

   ```bash
   docker run --rm \
     -v pluma_pluma-data:/data \
     -v $(pwd)/backups:/backup \
     alpine sh -c "cd /data && tar xzf /backup/pluma-backup-YYYYMMDD-HHMMSS.tar.gz --strip 1"
   ```

3. Restart the backend:
   ```bash
   docker-compose start backend
   ```

## Configuration

Customize backup settings in `docker-compose.yml`:

```yaml
backup:
  environment:
    - BACKUP_RETENTION=7 # Days to keep backups
    - BACKUP_SCHEDULE=0 2 * * * # Cron schedule (default: 2 AM daily)
```
