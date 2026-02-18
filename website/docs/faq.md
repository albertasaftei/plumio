---
sidebar_position: 7
title: FAQ
---

# Frequently Asked Questions

Common questions about plumio installation, configuration, and usage.

## Installation & Deployment

### What are the system requirements?

**Minimum:**

- Docker 20.10+
- Docker Compose 2.0+
- 512MB RAM
- 2GB disk space

**Recommended:**

- 1GB+ RAM
- 10GB+ disk space (depends on usage)
- SSD for better performance

### Can I install plumio without Docker?

Yes! You can run Plumio from source. See the [Self-Hosting Guide - From Source](/docs/self-hosting#from-source) section for detailed instructions.

### Which databases does plumio support?

plumio uses SQLite for simplicity and portability. SQLite is perfect for single-server deployments and handles thousands of notes efficiently.

For large-scale deployments, PostgreSQL support may be added in future versions.

### Can I run plumio on ARM64/Raspberry Pi?

Yes! Docker images are available for both amd64 and arm64 architectures. plumio runs well on:

- Raspberry Pi 4 (4GB+ recommended)
- Apple Silicon Macs (M1/M2/M3)
- ARM-based cloud instances

---

## Security & Privacy

### Is my data encrypted?

plumio offers multiple layers of security:

1. **In Transit**: Use HTTPS with a reverse proxy (recommended)
2. **At Rest**: Optional AES-256 encryption via `ENABLE_ENCRYPTION=true`
3. **Authentication**: JWT-based with bcrypt password hashing

### Where is my data stored?

All data is stored locally in the Docker volume:

- **Database**: SQLite file at `/data/plumio.db`
- **Documents**: Markdown files in `/data/documents`

Nothing is sent to external services.

### Can I use plumio offline?

Once deployed, plumio works completely offline within your network. You only need internet for:

- Initial Docker image pull
- Updates

### What happens if I lose my encryption key?

**Encrypted documents cannot be recovered** without the encryption key. Always:

1. Back up your `.env` file securely
2. Store `ENCRYPTION_KEY` in a password manager
3. Keep offline copies in a safe location

### Is plumio GDPR compliant?

As a self-hosted solution, you have complete control over data. plumio:

- Stores no data externally
- Has no telemetry or tracking
- Doesn't use third-party services

You're responsible for GDPR compliance in your deployment.

---

## Features & Functionality

### Does plumio support real-time collaboration?

Not currently. plumio is designed for individual use or small teams with turn-based editing. Real-time collaboration may be added in future versions.

### Can I attach files to notes?

Currently, plumio focuses on markdown text. You can:

- Link to external files
- Embed images via URL
- Use code blocks for content

File attachment support is planned for future releases.

### Does plumio have a mobile app?

Not yet. The web interface is responsive and works on mobile browsers, but native mobile apps might be planned for the future if the project gains enough interest and resources.

### Can I sync between multiple devices?

Deploy plumio on a server accessible to all your devices, and access it through the web interface from any device. Data stays centralized on your server.

### Does plumio support plugins?

Plugin support is not available yet but is planned for future versions.

---

## Configuration & Customization

### How do I change the default port?

In `docker-compose.yml`, modify the ports mapping:

```yaml
ports:
  - "8080:3000" # Frontend on port 8080
  - "8081:3001" # Backend on port 8081
```

Update your `.env`:

```env
FRONTEND_PORT=8080
```

### Can I use a custom domain?

Yes! Set up a reverse proxy (Nginx, Caddy, Traefik) with your domain pointing to plumio. See the [Reverse Proxy section](/docs/self-hosting#using-a-reverse-proxy).

### How do I enable HTTPS?

Use a reverse proxy with SSL/TLS certificates:

**Option 1: Let's Encrypt with Nginx**

```bash
certbot --nginx -d plumio.yourdomain.com
```

**Option 2: Caddy (automatic HTTPS)**

```caddy
plumio.yourdomain.com {
    reverse_proxy localhost:3000
}
```

### How do I add more users?

Admin users can create additional users:

1. Settings → Admin Panel
2. Create User
3. Assign username and password

See [User Management](/docs/usage-guide#user-management-admin).

---

## Backup & Migration

### How often should I backup?

Recommended backup frequency:

- **Daily** for active use
- **Weekly** for occasional use
- **Before updates** always

Enable [automated backups](/docs/configuration#backup-configuration) for peace of mind.

### What's included in backups?

Backups include:

- SQLite database (users, organizations, metadata)
- All markdown documents
- User settings and preferences
- Folder structure

For backup commands and instructions, see the [Self-Hosting Guide - Data Backup](/docs/self-hosting#data-backup) section.

### Can I migrate from another note-taking app?

plumio can import from:

- Standard Notes (JSON export)
- Obsidian (markdown folder)
- Any markdown-based system
- Generic markdown files

See [Import & Export](/docs/usage-guide#import--export).

### How do I migrate to a new server?

For detailed backup and restore instructions, see the [Self-Hosting Guide - Data Backup](/docs/self-hosting#data-backup) section.

---

## Performance & Troubleshooting

### plumio is running slowly

**Check resource usage:**

```bash
docker stats plumio
```

**Common fixes:**

1. Increase memory limits in docker-compose.yml
2. Optimize SQLite database
3. Clear old archived/deleted notes
4. Use SSD storage

### Database is locked error

This happens when multiple processes access SQLite simultaneously.

**Solution:**

```bash
docker-compose restart plumio
```

**Prevention:**

- Use WAL mode (enabled by default)
- Avoid manual database manipulation while running

### Container won't start

**Check logs:**

```bash
docker-compose logs plumio
```

**Common issues:**

- Invalid `ENCRYPTION_KEY` (must be 64 hex characters)
- Port conflicts (change ports in docker-compose.yml)
- Permission issues (check volume permissions)

### Forgot admin password

Reset the database (will delete all data):

```bash
docker-compose down
docker volume rm plumio_plumio-data
docker-compose up -d
```

Or manually reset the password in SQLite (advanced).

### Notes aren't syncing

plumio doesn't sync - it's a centralized application. All users access the same server. If changes aren't appearing:

1. Check network connectivity
2. Refresh the browser
3. Check for JavaScript errors in browser console
4. Verify the server is running

---

## Updates & Maintenance

### How do I update plumio?

For update instructions, see the [Self-Hosting Guide - Updating](/docs/self-hosting#updating) section.

Docker will download the latest image and recreate the container while preserving data.

### Will updates break my data?

No. The data volume is preserved across updates. However:

- Always backup before updating
- Check release notes for breaking changes
- Test updates in a staging environment first

### How do I check my current version?

```bash
docker-compose exec plumio node --version
```

Or check the container image tag:

```bash
docker-compose images
```

### Can I run multiple plumio instances?

Yes! Run separate instances with different:

- Port mappings
- Volume names
- Container names
- Network names

Useful for production/staging separation.

---

## Licensing & Support

### What license is plumio under?

plumio is open source under the **MIT License**. You're free to:

- Use for personal or commercial purposes
- Modify the code
- Distribute copies
- Use in proprietary software

### Is plumio free?

Yes, completely free and open source. No premium tiers, no paid features.

### How do I get support?

**Community Support:**

- [GitHub Issues](https://github.com/albertasaftei/plumio/issues) for bugs
- [GitHub Discussions](https://github.com/albertasaftei/plumio/discussions) for questions
- Read this documentation

**Contributing:**

- Submit bug reports
- Suggest features
- Contribute code via pull requests

### Can I contribute to plumio?

Absolutely! Contributions are welcome:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

See [CONTRIBUTING.md](https://github.com/albertasaftei/plumio/blob/main/CONTRIBUTING.md) for guidelines.

---

## Still Have Questions?

Can't find what you're looking for?

- Check the [Usage Guide](/docs/usage-guide)
- Review [Configuration options](/docs/configuration)
- Browse [Environment Variables](/docs/environment-variables)
- [Open an issue](https://github.com/albertasaftei/plumio/issues/new) on GitHub
