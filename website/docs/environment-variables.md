---
sidebar_position: 3
title: Environment Variables
---

# Environment Variables Reference

This page provides a comprehensive reference for all environment variables used in plumio. These variables control various aspects of the application's behavior, security, and storage.

## Required Variables

### JWT_SECRET

**Type:** `string`  
**Required:** Yes  
**Default:** None

Secret key used to sign and verify JSON Web Tokens (JWT) for user authentication sessions.

**How to generate:**

```bash
openssl rand -base64 32
```

**Example:**

```env
JWT_SECRET=mT8vK3pL9nX2qW5yR7jH4gF6dS1aZ0xC
```

:::danger Security Warning
This must be a strong, random string. Never use a simple password or commit this to version control. If this value is compromised, all user sessions will need to be invalidated.
:::

---

### ENCRYPTION_KEY

**Type:** `string` (hex)  
**Required:** Yes (if `ENABLE_ENCRYPTION=true`)  
**Default:** None  
**Format:** 64 hexadecimal characters (32 bytes)

Encryption key used for AES-256 encryption of document content when encryption is enabled.

**How to generate:**

```bash
openssl rand -hex 32
```

**Example:**

```env
ENCRYPTION_KEY=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
```

:::warning Important

- Must be exactly 64 hexadecimal characters (32 bytes)
- Keep this key secure and backed up
- If lost, encrypted documents cannot be recovered
- Changing this key will make existing encrypted documents unreadable
  :::

---

## Backend Configuration

### BACKEND_INTERNAL_PORT

**Type:** `number`  
**Required:** No  
**Default:** `3001`

The port on which the backend API server listens internally within the container.

**Example:**

```env
BACKEND_INTERNAL_PORT=3001
```

:::tip
In most cases, you don't need to change this. Use Docker port mapping instead to expose the backend on a different external port.
:::

---

### DOCUMENTS_PATH

**Type:** `string` (file path)  
**Required:** No  
**Default:** `./documents`

Path where markdown documents are stored on the filesystem.

**Docker default:**

```env
DOCUMENTS_PATH=/data/documents
```

**Local development:**

```env
DOCUMENTS_PATH=./documents
```

:::info
In Docker deployments, this should point to a location within the mounted volume to ensure persistence.
:::

---

### DB_PATH

**Type:** `string` (file path)  
**Required:** No  
**Default:** `./plumio.db`

Path to the SQLite database file.

**Docker default:**

```env
DB_PATH=/data/plumio.db
```

**Local development:**

```env
DB_PATH=./plumio.db
```

---

### ALLOWED_ORIGINS

**Type:** `string` (URL or comma-separated URLs)  
**Required:** No  
**Default:** `*` (development only)

Comma-separated list of allowed origins for CORS (Cross-Origin Resource Sharing). This controls which domains can make requests to the API.

**Single origin:**

```env
ALLOWED_ORIGINS=http://localhost:3000
```

**Multiple origins:**

```env
ALLOWED_ORIGINS=http://localhost:3000,https://plumio.yourdomain.com,https://notes.company.com
```

**Production example:**

```env
ALLOWED_ORIGINS=https://plumio.yourdomain.com
```

:::warning Production Security
In production, always specify exact origins. Never use `*` in production as it allows requests from any domain, creating security vulnerabilities.
:::

---

### ENABLE_ENCRYPTION

**Type:** `boolean`  
**Required:** No  
**Default:** `true`

Enable or disable AES-256 encryption for document content at rest.

**Values:**

- `true` - Enable encryption (requires valid `ENCRYPTION_KEY`)
- `false` - Disable encryption

**Example:**

```env
ENABLE_ENCRYPTION=true
```

:::info When to use encryption

- **Enable** if you're storing sensitive information and want an extra layer of security
- **Disable** for better performance if server-level encryption is sufficient
- Documents created with encryption enabled cannot be read if encryption is later disabled without the same key
  :::

---

### NODE_ENV

**Type:** `string`  
**Required:** No  
**Default:** `development`

Specifies the environment in which the application is running.

**Values:**

- `production` - Optimized for production use
- `development` - Includes debugging features

**Example:**

```env
NODE_ENV=production
```

---

## Frontend Configuration

### VITE_API_URL

**Type:** `string` (URL)  
**Required:** Yes (for local development)  
**Default:** None

URL of the backend API server. Used by the frontend to make API requests.

**Development:**

```env
VITE_API_URL=http://localhost:3001
```

**Production:**

```env
VITE_API_URL=https://api.plumio.yourdomain.com
```

:::note Docker Deployment
This variable is not needed in Docker deployments as the frontend and backend are bundled together and communicate internally.
:::

---

## Docker-Specific Variables

### FRONTEND_URL

**Type:** `string` (hostname)  
**Required:** No  
**Default:** `localhost`

The hostname where the frontend will be accessible. Used to construct `ALLOWED_ORIGINS`.

**Example:**

```env
FRONTEND_URL=plumio.yourdomain.com
```

---

### FRONTEND_PORT

**Type:** `number`  
**Required:** No  
**Default:** `3000`

The port on which the frontend will be accessible. Used to construct `ALLOWED_ORIGINS`.

**Example:**

```env
FRONTEND_PORT=443
```

---

## Complete Configuration Examples

### Minimal Configuration (.env)

For basic Docker deployment:

```env
JWT_SECRET=your-generated-jwt-secret-here
ENCRYPTION_KEY=your-generated-encryption-key-here
FRONTEND_URL=localhost
FRONTEND_PORT=3000
```

### Production Configuration (.env)

For production with reverse proxy:

```yaml
# Security
JWT_SECRET=mT8vK3pL9nX2qW5yR7jH4gF6dS1aZ0xC
ENCRYPTION_KEY=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2

# Deployment
FRONTEND_URL=plumio.yourdomain.com
FRONTEND_PORT=443
NODE_ENV=production
```

### Local Development Configuration

Backend `.env`:

```env
BACKEND_INTERNAL_PORT=3001
DOCUMENTS_PATH=./documents
DB_PATH=./plumio.db
JWT_SECRET=dev-secret-change-in-production
ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
ENABLE_ENCRYPTION=false
ALLOWED_ORIGINS=http://localhost:3000
```

Frontend `.env`:

```env
VITE_API_URL=http://localhost:3001
```

---

## Troubleshooting

### "ENCRYPTION_KEY must be exactly 64 hexadecimal characters"

Your encryption key is invalid. Generate a new one:

```bash
openssl rand -hex 32
```

### CORS errors in browser console

Check that `ALLOWED_ORIGINS` includes your frontend URL:

```env
ALLOWED_ORIGINS=http://localhost:3000
```

### Database file not found

Verify `DB_PATH` points to a valid location with write permissions:

```bash
docker-compose exec plumio ls -la /data/
```

### Documents not persisting

Ensure `DOCUMENTS_PATH` is within the mounted Docker volume:

```yaml
volumes:
  - plumio-data:/data
```

```env
DOCUMENTS_PATH=/data/documents
```
