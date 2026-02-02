---
sidebar_position: 7
title: Troubleshooting
---

# Troubleshooting Guide

Common issues and solutions when running plumio.

## Installation Issues

### Docker image fails to pull

**Error:** `Error response from daemon: manifest for ghcr.io/albertasaftei/plumio:latest not found`

**Solutions:**

1. Check your internet connection
2. Verify Docker is running: `docker ps`
3. Try pulling explicitly: `docker pull ghcr.io/albertasaftei/plumio:latest`
4. Check if the image exists on [GitHub Container Registry](https://github.com/albertasaftei/plumio/pkgs/container/plumio)

---

### Port already in use

**Error:** `Bind for 0.0.0.0:3000 failed: port is already allocated`

**Solution:** Change the port mapping in `docker-compose.yml`:

```yaml
ports:
  - "8080:3000" # Use port 8080 instead
  - "8081:3001"
```

**Check what's using the port:**

```bash
lsof -i :3000
# or on Linux
netstat -tulpn | grep 3000
```

---

### Permission denied errors

**Error:** `mkdir: cannot create directory '/data': Permission denied`

**Solutions:**

1. **Fix volume permissions:**

   ```bash
   docker-compose down
   docker volume rm plumio_plumio-data
   docker volume create plumio_plumio-data
   docker-compose up -d
   ```

2. **Use bind mount with correct permissions:**

   ```bash
   mkdir -p /path/to/data
   sudo chown -R 1000:1000 /path/to/data
   ```

   Update `docker-compose.yml`:

   ```yaml
   volumes:
     - /path/to/data:/data
   ```

---

## Runtime Issues

### Container starts but website is unreachable

**Check container status:**

```bash
docker-compose ps
```

**Check logs:**

```bash
docker-compose logs -f plumio
```

**Common causes:**

1. **Health check failing:**

   ```bash
   docker-compose exec plumio wget -qO- http://localhost:3001/api/health
   ```

2. **Firewall blocking access:**

   ```bash
   # Check if ports are listening
   netstat -tulpn | grep -E '3000|3001'
   ```

3. **Wrong ALLOWED_ORIGINS:**
   - Check `.env` file
   - Verify it matches your frontend URL

---

### Database is locked

**Error:** `database is locked` or `SQLITE_BUSY`

**Immediate fix:**

```bash
docker-compose restart plumio
```

**Permanent solution:**

Ensure WAL mode is enabled. Create a file `init-db.sql`:

```sql
PRAGMA journal_mode=WAL;
PRAGMA busy_timeout=5000;
```

This is usually enabled by default in plumio.

**Causes:**

- Multiple simultaneous writes
- Long-running transactions
- Backup process accessing database

---

### High memory usage

**Check memory usage:**

```bash
docker stats plumio
```

**Solutions:**

1. **Increase limits in docker-compose.yml:**

   ```yaml
   deploy:
     resources:
       limits:
         memory: 2G
   ```

2. **Optimize Node.js heap:**

   ```yaml
   environment:
     - NODE_OPTIONS=--max-old-space-size=1024
   ```

3. **Clear cache:**
   ```bash
   docker-compose restart plumio
   ```

---

### Slow performance

**Diagnose:**

1. **Check disk I/O:**

   ```bash
   docker-compose exec plumio df -h /data
   ```

2. **Check database size:**

   ```bash
   docker-compose exec plumio du -sh /data/plumio.db
   ```

3. **Monitor resources:**
   ```bash
   docker stats plumio
   ```

**Solutions:**

1. **Use SSD storage** for better performance

2. **Optimize SQLite:**

   ```bash
   docker-compose exec plumio sh -c "
     sqlite3 /data/plumio.db 'VACUUM;'
     sqlite3 /data/plumio.db 'PRAGMA optimize;'
   "
   ```

3. **Clean up old data:**
   - Archive unused notes
   - Delete old revisions
   - Remove deleted items permanently

4. **Increase resources:**
   ```yaml
   deploy:
     resources:
       limits:
         cpus: "2.0"
         memory: 2G
   ```

---

## Authentication Issues

### Forgot admin password

**Option 1: Reset via database (if you have access):**

```bash
# Generate bcrypt hash for new password
docker-compose exec plumio node -e "
const bcrypt = require('bcrypt');
bcrypt.hash('new-password', 10, (err, hash) => {
  console.log(hash);
});
"

# Update database
docker-compose exec plumio sqlite3 /data/plumio.db "
UPDATE users SET password_hash='<hash-from-above>' WHERE username='admin';
"
```

**Option 2: Reset all data (destructive):**

```bash
# Backup first!
docker run --rm -v plumio_plumio-data:/data -v $(pwd):/backup \
  alpine tar czf /backup/backup-before-reset.tar.gz -C /data .

# Reset
docker-compose down
docker volume rm plumio_plumio-data
docker-compose up -d
```

---

### JWT token invalid/expired

**Error in console:** `Invalid token` or `Token expired`

**Solutions:**

1. **Clear browser storage:**
   - Open Developer Tools (F12)
   - Application → Local Storage
   - Clear all entries for your plumio domain

2. **Logout and login again**

3. **Check JWT_SECRET hasn't changed:**
   - Changing JWT_SECRET invalidates all existing tokens
   - Users need to re-login

---

## Data Issues

### Documents not saving

**Check:**

1. **Browser console for errors:**
   - Press F12
   - Check Console tab
   - Look for failed API requests

2. **Backend logs:**

   ```bash
   docker-compose logs -f plumio | grep ERROR
   ```

3. **Disk space:**

   ```bash
   docker-compose exec plumio df -h /data
   ```

4. **Permissions:**
   ```bash
   docker-compose exec plumio ls -la /data/documents
   ```

---

### Documents disappeared

**Possible causes:**

1. **Check Deleted folder** - Documents may be soft-deleted
2. **Check different organization** - Wrong organization selected
3. **Database corruption** - Restore from backup

**Recovery steps:**

1. **Check if files exist:**

   ```bash
   docker-compose exec plumio find /data/documents -name "*.md"
   ```

2. **Check database:**

   ```bash
   docker-compose exec plumio sqlite3 /data/plumio.db "
   SELECT id, title, is_deleted FROM documents LIMIT 10;
   "
   ```

3. **Restore from backup:**
   ```bash
   docker-compose down
   docker run --rm -v plumio_plumio-data:/data -v $(pwd)/backups:/backup \
     alpine tar xzf /backup/your-backup.tar.gz -C /data
   docker-compose up -d
   ```

---

### Encryption/Decryption errors

**Error:** `Decryption failed` or `Invalid encryption key`

**Causes:**

- ENCRYPTION_KEY changed
- Document encrypted with different key
- Corruption during encryption

**Solutions:**

1. **Verify ENCRYPTION_KEY matches original:**

   ```bash
   cat .env | grep ENCRYPTION_KEY
   ```

2. **Disable encryption temporarily (for new docs only):**

   ```env
   ENABLE_ENCRYPTION=false
   ```

   Existing encrypted documents still need the original key.

3. **Restore from backup** if key is lost permanently

:::danger Data Loss
Encrypted documents cannot be decrypted without the original ENCRYPTION_KEY. Always backup this key securely.
:::

---

## Network Issues

### CORS errors

**Error in browser console:** `CORS policy: No 'Access-Control-Allow-Origin' header`

**Solutions:**

1. **Update ALLOWED_ORIGINS in docker-compose.yml:**

   ```yaml
   environment:
     - ALLOWED_ORIGINS=http://localhost:3000,https://plumio.yourdomain.com
   ```

2. **Restart container:**

   ```bash
   docker-compose down && docker-compose up -d
   ```

3. **Check frontend and backend URLs match:**
   - Frontend: `http://localhost:3000`
   - API: `http://localhost:3001`
   - ALLOWED_ORIGINS should include frontend URL

---

### Can't access from other devices on network

**Solutions:**

1. **Bind to all interfaces:**

   ```yaml
   ports:
     - "0.0.0.0:3000:3000"
     - "0.0.0.0:3001:3001"
   ```

2. **Update ALLOWED_ORIGINS:**

   ```env
   ALLOWED_ORIGINS=http://192.168.1.100:3000
   ```

3. **Check firewall:**

   ```bash
   # Linux (ufw)
   sudo ufw allow 3000/tcp
   sudo ufw allow 3001/tcp

   # Linux (firewalld)
   sudo firewall-cmd --add-port=3000/tcp --permanent
   sudo firewall-cmd --add-port=3001/tcp --permanent
   sudo firewall-cmd --reload
   ```

---

## Backup & Restore Issues

### Backup fails

**Error:** `tar: can't create file: Permission denied`

**Solution:**

```bash
# Use alpine container with proper permissions
docker run --rm \
  -v plumio_plumio-data:/data:ro \
  -v $(pwd)/backups:/backup \
  alpine sh -c "cd /data && tar czf /backup/backup-$(date +%Y%m%d).tar.gz ."
```

---

### Restore fails

**Error:** `tar: can't open: No such file or directory`

**Solutions:**

1. **Verify backup file exists:**

   ```bash
   ls -lh backups/
   ```

2. **Check backup integrity:**

   ```bash
   tar tzf backups/your-backup.tar.gz | head
   ```

3. **Restore with correct permissions:**
   ```bash
   docker-compose down
   docker run --rm \
     -v plumio_plumio-data:/data \
     -v $(pwd)/backups:/backup \
     alpine sh -c "rm -rf /data/* && tar xzf /backup/your-backup.tar.gz -C /data"
   docker-compose up -d
   ```

---

## Browser Issues

### Page won't load

**Steps:**

1. **Clear browser cache:**
   - Chrome/Edge: Ctrl+Shift+Del
   - Firefox: Ctrl+Shift+Del
   - Safari: Cmd+Option+E

2. **Try incognito/private mode**

3. **Check browser console** (F12) for errors

4. **Try different browser**

---

### Editor not working

**Common causes:**

1. **JavaScript disabled** - Enable in browser settings
2. **Ad blocker interfering** - Whitelist your plumio domain
3. **Old cached files** - Clear cache
4. **Browser not supported** - Use modern browser (Chrome, Firefox, Edge, Safari)

---

## Docker Compose Issues

### docker-compose command not found

**Solution:**

Install Docker Compose V2:

```bash
# Linux
sudo apt-get update
sudo apt-get install docker-compose-plugin

# Mac
# Included with Docker Desktop

# Verify
docker compose version
```

---

### Environment variables not loaded

**Check .env file:**

```bash
cat .env
```

**Ensure it's in the same directory as docker-compose.yml**

**Restart to apply changes:**

```bash
docker-compose down
docker-compose up -d
```

---

## Getting More Help

If your issue isn't listed here:

1. **Check logs:**

   ```bash
   docker-compose logs --tail=100 plumio
   ```

2. **Enable debug mode:**

   ```yaml
   environment:
     - NODE_ENV=development
     - DEBUG=*
   ```

3. **Search existing issues:**
   [GitHub Issues](https://github.com/albertasaftei/plumio/issues)

4. **Create a new issue:**
   Include:
   - plumio version
   - Docker version
   - Operating system
   - Complete error messages
   - Steps to reproduce
   - Relevant logs

5. **Check documentation:**
   - [Installation Guide](/docs/installation)
   - [Configuration](/docs/configuration)
   - [FAQ](/docs/faq)
