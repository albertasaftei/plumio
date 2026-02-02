---
sidebar_position: 2
title: Installation
---

# Installation Guide

This guide will walk you through deploying plumio on your server using Docker. The entire application runs in a single container, making deployment simple and straightforward.

## Prerequisites

Before you begin, ensure you have the following installed on your server:

- **Docker** (version 20.10 or higher)
- **Docker Compose** (version 2.0 or higher)
- **OpenSSL** (for generating secure keys)

:::tip Quick Docker Installation
If you don't have Docker installed, you can install it quickly on most Linux distributions:

```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
```

:::

## Quick Start

### 1. Create a Project Directory

Create a directory for plumio and navigate to it:

```bash
mkdir plumio
cd plumio
```

### 2. Create Environment File

Create a `.env` file with your configuration:

```yaml
# Generate secure secrets
JWT_SECRET -> $(openssl rand -base64 32)
ENCRYPTION_KEY -> $(openssl rand -hex 32)

# Create .env file
JWT_SECRET=${JWT_SECRET}
ENCRYPTION_KEY=${ENCRYPTION_KEY}
FRONTEND_URL=localhost
FRONTEND_PORT=3000
```

:::warning Important
The `ENCRYPTION_KEY` must be exactly 64 hexadecimal characters (32 bytes). The command above generates this correctly.
:::

### 3. Create Docker Compose File

Create a `docker-compose.yml` file:

```yaml
version: "3.8"

services:
  plumio:
    image: ghcr.io/albertasaftei/plumio:latest
    container_name: plumio
    restart: unless-stopped
    ports:
      - "3000:3000" # Frontend
      - "3001:3001" # Backend API
    environment:
      - NODE_ENV=production
      - BACKEND_INTERNAL_PORT=3001
      - DOCUMENTS_PATH=/data/documents
      - DB_PATH=/data/plumio.db
      - JWT_SECRET=${JWT_SECRET}
      - ENCRYPTION_KEY=${ENCRYPTION_KEY}
      - ALLOWED_ORIGINS=http://${FRONTEND_URL}:${FRONTEND_PORT}
      - ENABLE_ENCRYPTION=true
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
      interval: 5m
      timeout: 10s
      retries: 3
      start_period: 40s
    deploy:
      resources:
        limits:
          memory: 1G
        reservations:
          memory: 512M

volumes:
  plumio-data:
    driver: local

networks:
  plumio-network:
    driver: bridge
```

### 4. Start plumio

Pull the latest image and start the container:

```bash
docker-compose pull
docker-compose up -d
```

### 5. Access plumio

Open your browser and navigate to:

```
http://localhost:3000
```

On first visit, you'll be prompted to create an admin account.

## Verify Installation

Check if the container is running:

```bash
docker-compose ps
```

View logs:

```bash
docker-compose logs -f plumio
```

Check health status:

```bash
docker-compose exec plumio wget -qO- http://localhost:3001/api/health
```

## Using a Reverse Proxy

For production deployments, it's recommended to use a reverse proxy like Nginx or Caddy with SSL/TLS.

### Example: Nginx Configuration

```yaml
server {
    listen 80;
    server_name plumio.yourdomain.com;

    # Redirect to HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name plumio.yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

:::tip Caddy Alternative
Using Caddy makes SSL even easier with automatic HTTPS:

```caddy
plumio.yourdomain.com {
    reverse_proxy localhost:3000
    reverse_proxy /api/* localhost:3001
}
```

:::

### Update Environment for Reverse Proxy

When using a reverse proxy, update your `.env` file:

```env
FRONTEND_URL=plumio.yourdomain.com
FRONTEND_PORT=443
```

And update the `ALLOWED_ORIGINS` in `docker-compose.yml`:

```yaml
- ALLOWED_ORIGINS=https://plumio.yourdomain.com
```

Then restart:

```bash
docker-compose down
docker-compose up -d
```

## Updating plumio

To update to the latest version:

```bash
docker-compose pull
docker-compose up -d
```

Docker Compose will automatically recreate the container with the new image while preserving your data.

## Backup Your Data

All your data is stored in the `plumio-data` volume. To back it up:

```yaml
# Create backup directory
mkdir -p backups

# Backup the data volume
docker run --rm \
  -v plumio_plumio-data:/data \
  -v $(pwd)/backups:/backup \
  alpine tar czf /backup/plumio-backup-$(date +%Y%m%d-%H%M%S).tar.gz -C /data .
```

To restore from backup:

```yaml
# Stop plumio
docker-compose down

# Restore data
docker run --rm \
  -v plumio_plumio-data:/data \
  -v $(pwd)/backups:/backup \
  alpine sh -c "cd /data && tar xzf /backup/your-backup-file.tar.gz"

# Start plumio
docker-compose up -d
```

## Troubleshooting

### Container won't start

Check the logs:

```bash
docker-compose logs plumio
```

### Can't connect to frontend

1. Verify the container is running: `docker-compose ps`
2. Check if port 3000 is accessible: `curl http://localhost:3000`
3. Check firewall settings

### Database errors

Ensure the data volume has proper permissions:

```bash
docker-compose exec plumio ls -la /data
```

### Reset admin password

If you forget your admin password, you'll need to reset the database:

```bash
docker-compose down
docker volume rm plumio_plumio-data
docker-compose up -d
```

:::danger Data Loss Warning
Removing the volume will delete all your notes and settings. Make sure to backup first!
:::

## Next Steps

- [Configuration Guide](/docs/configuration) - Learn about all available configuration options
- [Environment Variables](/docs/environment-variables) - Detailed explanation of all environment variables
