---
sidebar_position: 4
title: Configuration
---

# Configuration Guide

This guide covers advanced configuration options for plumio, including resource limits, health checks, backups, and optimization tips.

## Docker Resource Limits

Control how much CPU and memory plumio can use to prevent resource exhaustion.

### Memory Limits

In your `docker-compose.yml`:

```yaml
services:
  plumio:
    # ... other configuration ...
    deploy:
      resources:
        limits:
          memory: 1G # Maximum memory usage
        reservations:
          memory: 512M # Guaranteed minimum
```

**Recommendations:**

- **Minimum:** 512MB for small deployments (1-5 users)
- **Recommended:** 1GB for medium deployments (5-20 users)
- **Large deployments:** 2GB+ for 20+ concurrent users

### CPU Limits

Add CPU limits if needed:

```yaml
deploy:
  resources:
    limits:
      cpus: "2.0" # Maximum 2 CPU cores
      memory: 1G
    reservations:
      cpus: "0.5" # Minimum 0.5 CPU cores
      memory: 512M
```

---

## Health Checks

plumio includes built-in health checking to monitor application status.

### Default Health Check

```yaml
healthcheck:
  test:
    [
      "CMD",
      "wget",
      "--no-verbose",
      "--tries=1",
      "--spider",
      "http://localhost:3001/api/health",
    ]
  interval: 5m # Check every 5 minutes
  timeout: 10s # Timeout after 10 seconds
  retries: 3 # Retry 3 times before marking unhealthy
  start_period: 40s # Wait 40s before starting checks
```

### Custom Health Check Intervals

For high-availability setups:

```yaml
healthcheck:
  test:
    [
      "CMD",
      "wget",
      "--no-verbose",
      "--tries=1",
      "--spider",
      "http://localhost:3001/api/health",
    ]
  interval: 30s # More frequent checks
  timeout: 5s
  retries: 3
  start_period: 30s
```

### Manual Health Check

Test the health endpoint manually:

```bash
curl http://localhost:3001/api/health
```

Expected response:

```json
{
  "status": "healthy",
  "timestamp": "2026-02-02T10:30:00.000Z"
}
```

---

## Port Configuration

### Custom Ports

Change the exposed ports if 3000/3001 are already in use:

```yaml
services:
  plumio:
    ports:
      - "8080:3000" # Frontend on port 8080
      - "8081:3001" # Backend on port 8081
```

Update your `.env`:

```env
FRONTEND_PORT=8080
```

### Internal Only (with Reverse Proxy)

If using a reverse proxy, don't expose ports externally:

```yaml
services:
  plumio:
    expose:
      - "3000"
      - "3001"
    networks:
      - proxy-network
      - plumio-network
```

---

## Storage Configuration

### Data Persistence

All data is stored in Docker volumes:

```yaml
volumes:
  plumio-data:
    driver: local
```

### Custom Volume Location

Use bind mounts for specific locations:

```yaml
services:
  plumio:
    volumes:
      - /path/on/host:/data
```

:::warning Permissions
Ensure the directory has proper permissions:

```bash
mkdir -p /path/on/host
chmod 755 /path/on/host
```

:::

### Multiple Volume Mounts

Separate documents and database:

```yaml
services:
  plumio:
    volumes:
      - plumio-db:/data/db
      - plumio-docs:/data/documents
    environment:
      - DB_PATH=/data/db/plumio.db
      - DOCUMENTS_PATH=/data/documents

volumes:
  plumio-db:
  plumio-docs:
```

---

## Backup Configuration

plumio supports automated backups using Docker Compose profiles and a backup service container.

### Quick Setup

1. Create a `backup.sh` script in your project directory
2. Enable the backup service profile:
   ```bash
   docker-compose --profile backup up -d
   ```

### Manual Backup

Quick manual backup:

```bash
docker run --rm \
  -v plumio_plumio-data:/data \
  -v $(pwd)/backups:/backup \
  alpine tar czf /backup/manual-backup-$(date +%Y%m%d-%H%M%S).tar.gz -C /data .
```

For detailed backup configuration, automated backup scripts, and restore procedures, see the [Self-Hosting Guide](/docs/self-hosting#data-backup-and-restore)

---

## Network Configuration

### Custom Network

Create a custom network for plumio:

```yaml
networks:
  plumio-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.28.0.0/16
```

### Connect to Existing Network

Join an existing Docker network:

```yaml
networks:
  plumio-network:
    external: true
    name: my-existing-network
```

---

## Security Hardening

### Read-Only Root Filesystem

Add extra security with read-only filesystem:

```yaml
services:
  plumio:
    read_only: true
    tmpfs:
      - /tmp
      - /var/tmp
    volumes:
      - plumio-data:/data # Writable volume for data
```

### Drop Capabilities

Remove unnecessary Linux capabilities:

```yaml
services:
  plumio:
    cap_drop:
      - ALL
    cap_add:
      - CHOWN
      - SETGID
      - SETUID
```

### Run as Non-Root User

```yaml
services:
  plumio:
    user: "1000:1000" # Use your user ID
```

:::warning Data Permissions
Ensure data volumes have correct ownership:

```bash
sudo chown -R 1000:1000 /path/to/data
```

:::

---

## Logging

### Configure Log Driver

Send logs to a centralized system:

```yaml
services:
  plumio:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

### Syslog

Send to syslog:

```yaml
logging:
  driver: "syslog"
  options:
    syslog-address: "tcp://192.168.1.100:514"
    tag: "plumio"
```

### View Logs

```bash
# All logs
docker-compose logs

# Follow logs
docker-compose logs -f

# Last 100 lines
docker-compose logs --tail=100

# Specific service with timestamps
docker-compose logs -f --timestamps plumio
```

---

## Performance Tuning

### SQLite Optimization

plumio uses SQLite with optimized settings for performance. For detailed database maintenance, optimization commands, and troubleshooting, see the [Self-Hosting Guide](/docs/self-hosting#database-maintenance)

### Node.js Memory

Increase Node.js heap size for large deployments:

```yaml
services:
  plumio:
    environment:
      - NODE_OPTIONS=--max-old-space-size=2048
```

---

## Reverse Proxy Examples

### Traefik

```yaml
services:
  plumio:
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.plumio.rule=Host(`plumio.yourdomain.com`)"
      - "traefik.http.routers.plumio.entrypoints=websecure"
      - "traefik.http.routers.plumio.tls.certresolver=letsencrypt"
      - "traefik.http.services.plumio.loadbalancer.server.port=3000"
    networks:
      - traefik
      - plumio-network

networks:
  traefik:
    external: true
```

### Nginx Proxy Manager

1. Add Proxy Host in Nginx Proxy Manager UI
2. Domain: `plumio.yourdomain.com`
3. Forward Hostname: `plumio`
4. Forward Port: `3000`
5. Enable SSL with Let's Encrypt

---

## Environment-Specific Configurations

### Development

```yaml
services:
  plumio:
    build: .
    environment:
      - NODE_ENV=development
      - ENABLE_ENCRYPTION=false
    volumes:
      - ./backend:/app/backend
      - ./frontend:/app/frontend
```

### Staging

```yaml
services:
  plumio:
    image: ghcr.io/albertasaftei/plumio:staging
    environment:
      - NODE_ENV=staging
      - ALLOWED_ORIGINS=https://staging.plumio.yourdomain.com
```

### Production

```yaml
services:
  plumio:
    image: ghcr.io/albertasaftei/plumio:latest
    restart: always
    environment:
      - NODE_ENV=production
      - ENABLE_ENCRYPTION=true
    deploy:
      resources:
        limits:
          memory: 2G
```

---

## Complete Production Example

Here's a complete production-ready configuration:

```yaml
version: "3.8"

services:
  plumio:
    image: ghcr.io/albertasaftei/plumio:latest
    container_name: plumio
    restart: always

    ports:
      - "127.0.0.1:3000:3000" # Bind to localhost only
      - "127.0.0.1:3001:3001"

    environment:
      - NODE_ENV=production
      - BACKEND_INTERNAL_PORT=3001
      - DOCUMENTS_PATH=/data/documents
      - DB_PATH=/data/plumio.db
      - JWT_SECRET=${JWT_SECRET}
      - ENCRYPTION_KEY=${ENCRYPTION_KEY}
      - ALLOWED_ORIGINS=https://plumio.yourdomain.com
      - ENABLE_ENCRYPTION=true
      - NODE_OPTIONS=--max-old-space-size=2048

    volumes:
      - plumio-data:/data

    networks:
      - plumio-network

    healthcheck:
      test:
        [
          "CMD",
          "wget",
          "--no-verbose",
          "--tries=1",
          "--spider",
          "http://localhost:3001/api/health",
        ]
      interval: 1m
      timeout: 10s
      retries: 3
      start_period: 40s

    deploy:
      resources:
        limits:
          cpus: "2.0"
          memory: 2G
        reservations:
          cpus: "0.5"
          memory: 1G

    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "5"

  backup:
    image: alpine:latest
    container_name: plumio-backup
    restart: unless-stopped
    profiles:
      - backup
    volumes:
      - plumio-data:/data:ro
      - ./backups:/backups
      - ./backup.sh:/backup.sh
    environment:
      - BACKUP_RETENTION=14
    command: sh /backup.sh
    depends_on:
      - plumio
    networks:
      - plumio-network

volumes:
  plumio-data:
    driver: local

networks:
  plumio-network:
    driver: bridge
```

---

## Monitoring

### Check Container Stats

```bash
docker stats plumio
```

### Resource Usage

```bash
docker-compose exec plumio sh -c "df -h /data && free -h"
```

### Database Size

```bash
docker-compose exec plumio sh -c "du -sh /data/plumio.db"
```

---

## Next Steps

- Review [Environment Variables](/docs/environment-variables) for detailed configuration options
- Set up [Backup Strategy](#backup-configuration) for data protection
- Configure [Reverse Proxy](#reverse-proxy-examples) for SSL/TLS
