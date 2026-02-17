---
sidebar_position: 2
title: Self-Hosting
---

# Self-Hosting

Plumio can be self-hosted using Docker, Docker Compose, or from source. Choose the method that best fits your infrastructure.

## Using Docker

The quickest way to get started is with Docker:

```bash
docker run -d \
  --name plumio \
  -p 3000:3000 \
  -p 3001:3001 \
  -v plumio-data:/data \
  -e JWT_SECRET="$(openssl rand -base64 32)" \
  -e ENCRYPTION_KEY="$(openssl rand -base64 32)" \
  ghcr.io/albertasaftei/plumio:latest
```

Access Plumio at `http://localhost:3000`

### Environment Variables

| Variable            | Description                     | Required                        |
| ------------------- | ------------------------------- | ------------------------------- |
| `JWT_SECRET`        | Secret key for JWT tokens       | Yes                             |
| `ENCRYPTION_KEY`    | 32-character key for encryption | Yes                             |
| `DOCUMENTS_PATH`    | Path to store documents         | No (default: `/data/documents`) |
| `DB_PATH`           | Path to SQLite database         | No (default: `/data/plumio.db`) |
| `ENABLE_ENCRYPTION` | Enable document encryption      | No (default: `true`)            |

## Using Docker Compose

For production deployments, use Docker Compose for better configuration management.

### 1. Create docker-compose.yml

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

# Automated backup service (optional - requires --profile backup)
# backup:
#   image: alpine:latest
#   container_name: plumio-backup
#   restart: unless-stopped
#   profiles:
#     - backup
#   volumes:
#     - plumio-data:/data:ro  # Read-only access to data
#     - ./backups:/backups    # Backup destination
#     - ./backup.sh:/backup.sh  # Backup script (read-write for chmod)
#   environment:
#     - BACKUP_RETENTION=7    # Keep backups for 7 days
#     - BACKUP_SCHEDULE=0 2 * * *  # Daily at 2 AM
#   command: sh /backup.sh
#   depends_on:
#     - plumio
#   networks:
#     - plumio-network

volumes:
  plumio-data:
    driver: local

networks:
  plumio-network:
    driver: bridge
```

### 2. Start Plumio

```bash
docker-compose up -d
```

### 3. View logs

```bash
docker-compose logs -f
```

## From Source

For development or custom deployments, you can run Plumio from source.

### 1. Clone the repository

```bash
git clone https://github.com/albertasaftei/plumio.git
cd plumio
```

### 2. Set up Backend

```bash
cd backend
npm install
```

Create `backend/.env`:

```bash
BACKEND_INTERNAL_PORT=3001
DOCUMENTS_PATH=./documents
DB_PATH=./data/plumio.db
JWT_SECRET=$(openssl rand -base64 32)
ENCRYPTION_KEY=$(openssl rand -base64 32)
ENABLE_ENCRYPTION=true
```

Build and start backend:

```bash
npm run build
npm start
```

### 3. Set up Frontend

In a new terminal:

```bash
cd frontend
pnpm install
```

Create `frontend/.env`:

```bash
VITE_API_URL=http://localhost:3001
```

Build and start frontend:

```bash
pnpm dev
```

### 4. Access Plumio

Open your browser and navigate to `http://localhost:3000`

## Updating

### Docker/Docker Compose

```bash
# Pull latest image
docker pull ghcr.io/albertasaftei/plumio:latest

# Restart container
docker-compose down
docker-compose up -d
```

### From Source

```bash
git pull
cd backend && npm install && npm run build
cd ../frontend && pnpm install && pnpm build
# Restart both services
```

## Data Backup

Your data is stored in the following locations:

- **Docker volumes**: `/data` (contains `plumio.db` and `documents/`)
- **From source**: `backend/data/` and `backend/documents/`

### Backup Docker volumes

```bash
docker run --rm \
  -v plumio-data:/data \
  -v $(pwd)/backups:/backup \
  alpine tar czf /backup/plumio-backup-$(date +%Y%m%d).tar.gz /data
```

## Reverse Proxy (Optional)

To use Plumio with a reverse proxy like Nginx or Caddy:

### Nginx

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /api {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Caddy

```
your-domain.com {
    reverse_proxy localhost:3000
    reverse_proxy /api/* localhost:3001
}
```

## Troubleshooting

### Container won't start

Check logs: `docker logs plumio` or `docker-compose logs`

Common issues:

- Missing or invalid JWT_SECRET/ENCRYPTION_KEY
- Port already in use
- Insufficient permissions on data volume

### Cannot connect to API

Ensure:

- Backend is running on port 3001
- `VITE_API_URL` points to correct backend URL
- Firewall allows connections to both ports

### Database errors

The SQLite database is automatically created on first run. If you encounter errors:

```bash
# Backup and reset database
docker-compose down
docker volume rm plumio-data
docker-compose up -d
```
