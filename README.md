## Installation

### Option 1: Docker (Recommended)

1. **Clone the repository:**

   ```bash
   git clone https://github.com/albertasaftei/plumio.git
   cd plumio
   ```

2. **Set up environment variables:**

   Create a `.env` file with the variables shown above.

3. **Build and start with Docker Compose:**

   ```bash
   docker-compose up -d --build
   ```

4. **Access the application:**

   Open http://localhost:3000 in your browser and create your admin account on first visit.

5. **View logs:**

   ```bash
   docker logs plumio -f
   ```

### Option 2: Manual Setup

#### Backend

1. **Navigate to backend directory:**

   ```bash
   cd backend
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Create `.env` file:**

   ```env
   BACKEND_INTERNAL_PORT=3001
   DOCUMENTS_PATH=./documents
   JWT_SECRET=your-generated-jwt-secret-here
   ENCRYPTION_KEY=your-generated-encryption-key-here
   ```

4. **Start the backend server:**

   ```bash
   npm run dev
   ```

   Backend will run on http://localhost:3001

#### Frontend

1. **Navigate to frontend directory (in a new terminal):**

   ```bash
   cd frontend
   ```

2. **Install dependencies:**

   ```bash
   pnpm install
   ```

3. **Create `.env` file:**

   ```env
   VITE_API_URL=http://localhost:3001
   ```

4. **Start the frontend development server:**

   ```bash
   pnpm dev
   ```

   Frontend will run on http://localhost:3000

## Environment Variables

You need to set up the required environment variables. Generate secure keys using OpenSSL:

```bash
# Generate JWT secret (used for authentication tokens)
openssl rand -base64 32

# Generate encryption key (used for document encryption)
openssl rand -base64 32
```

Create a `.env` file in the root directory:

```env
# Required - Generate using: openssl rand -base64 32
JWT_SECRET=your-generated-jwt-secret-here
ENCRYPTION_KEY=your-generated-encryption-key-here

# Backend configuration
BACKEND_INTERNAL_PORT=3001
DOCUMENTS_PATH=./documents

# Frontend configuration
VITE_API_URL=http://localhost:3001
```

**⚠️ Important:** Keep your `ENCRYPTION_KEY` secure and backed up. If lost, all encrypted documents cannot be decrypted and will be permanently inaccessible.

## Backup and Restore

### Automated Backups (Optional)

Enable automated daily backups by starting with the `backup` profile:

```bash
docker-compose --profile backup up -d
```

See [BACKUP.md](BACKUP.md) for detailed backup/restore procedures.

### Create manual Backup or just use the in app export button

Create a one-time backup of all data (documents + database):

```bash
docker run --rm \
  -v plumio_plumio-data:/data \
  -v $(pwd)/backups:/backup \
  alpine tar czf /backup/plumio-backup-$(date +%Y%m%d-%H%M%S).tar.gz -C /data .
```

### Restore manually from Backup or just use the in app import button

```bash
docker run --rm \
  -v plumio_plumio-data:/data \
  -v $(pwd)/backups:/backup \
  alpine sh -c "rm -rf /data/* && tar xzf /backup/plumio-backup-YYYYMMDD-HHMMSS.tar.gz -C /data"
```

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## License

AGPL-3.0 License. See [LICENSE](LICENSE) for details.
