# Plumio - Project Summary for Developers

## Getting Started

### Development Setup

Start the backend:

```bash
cd backend
pnpm install
pnpm run dev
```

Start the frontend:

```bash
pnpm install
pnpm dev
```

Access at `http://localhost:3000`. Create your admin account on first visit (minimum 8 characters password).

### Production Deployment

Manual Docker deployment:

```bash
# Generate keys
openssl rand -base64 32  # JWT_SECRET
openssl rand -base64 32  # ENCRYPTION_KEY

# Create .env file with the generated keys
docker-compose up -d
```

### Default Ports

- Frontend: 3000
- Backend: 3001
- Nginx (if enabled): 80, 443

### Data Storage

- Development: `backend/documents/`
- Docker: Volume `plumio-data`

## Technology Stack

### Frontend

- **Framework**: SolidJS
- **Routing**: SolidStart
- **Styling**: UnoCSS
- **Markdown**: Milkdown Editor
- **Icons**: @iconify-json/carbon
- **Build**: Vinxi

### Backend

- **Framework**: Hono (fast web framework)
- **Runtime**: Node.js 22+
- **Language**: TypeScript
- **Authentication**: jose (JWT) + bcrypt
- **Encryption**: Node.js crypto (AES-256-CBC)
- **Build**: TypeScript compiler

## Key Features

### Frontend

- **Authentication UI** ([src/routes/index.tsx](src/routes/index.tsx))
  - Login/setup screen
  - JWT token management

- **Main Editor** ([src/routes/editor.tsx](src/routes/editor.tsx))
  - Document management
  - Auto-save functionality (1 second debounce)
  - Save status indicators

- **Markdown Editor Component** ([src/components/Editor.tsx](src/components/Editor.tsx))
  - Live markdown preview as you type
  - Syntax highlighting for code blocks (JavaScript, TypeScript, Python, CSS, JSON)
  - Tab key support in editor

- **Sidebar Component** ([src/components/Sidebar.tsx](src/components/Sidebar.tsx))
  - File browser with folder support
  - Search functionality
  - Create new documents/folders
  - Delete documents/folders
  - File metadata display (modified date)
  - Sorted display (folders first, alphabetical)

### Backend

- **Main Server** ([backend/src/index.ts](backend/src/index.ts))
  - Hono framework setup
  - CORS middleware
  - Route mounting
  - Auto-creates documents directory

- **Authentication Routes** ([backend/src/routes/auth.ts](backend/src/routes/auth.ts))
  - `/api/auth/check-setup` - Check if initial setup needed
  - `/api/auth/setup` - Create first admin user
  - `/api/auth/login` - Login and receive JWT
  - Password hashing with bcrypt
  - JWT token generation and verification
  - Stores users in `auth.json`

- **Document Routes** ([backend/src/routes/documents.ts](backend/src/routes/documents.ts))
  - `/api/documents/list` - List files and folders
  - `/api/documents/content` - Get document content (decrypted)
  - `/api/documents/save` - Save document (encrypted)
  - `/api/documents/folder` - Create folder
  - `/api/documents/delete` - Delete file/folder
  - `/api/documents/rename` - Rename/move file/folder
  - AES-256-CBC encryption for all documents
  - Path traversal protection
  - JWT authentication middleware

### Security Features

1. **Encryption**
   - All documents encrypted at rest with AES-256-CBC
   - Unique initialization vector (IV) per document
   - Configurable encryption key

2. **Authentication**
   - Bcrypt password hashing (10 rounds)
   - JWT tokens with 7-day expiration
   - Secure secret key
   - Token verification on all protected endpoints

3. **API Security**
   - CORS protection
   - Path sanitization (prevents directory traversal)
   - Authentication middleware
   - Input validation

4. **Transport Security**
   - Optional HTTPS via nginx reverse proxy
   - SSL/TLS certificate support
   - Security headers (HSTS, X-Frame-Options, etc.)

### Deployment Configuration

- **Docker Setup** ([Dockerfile](Dockerfile), [backend/Dockerfile](backend/Dockerfile))
  - Node.js 22 Alpine base
  - Multi-stage builds for smaller images
  - Proper layer caching
  - Production optimized

- **Docker Compose** ([docker-compose.yml](docker-compose.yml))
  - Frontend service (port 3000)
  - Backend service (port 3001)
  - Nginx reverse proxy (ports 80/443)
  - Named volume for data persistence
  - Environment variable configuration
  - Service networking

- **Nginx Configuration** ([nginx.conf](nginx.conf))
  - HTTP to HTTPS redirect
  - SSL/TLS termination
  - Proxy to frontend and backend
  - Security headers
  - Proper WebSocket support

## Environment Variables

### Required (Production)

- `JWT_SECRET` - Secret key for JWT signing (32+ characters)
- `ENCRYPTION_KEY` - Key for AES-256 encryption (32 characters)

### Optional

- `BACKEND_INTERNAL_PORT` - Backend port (default: 3001)
- `DOCUMENTS_PATH` - Document storage path (default: ./documents)
- `AUTH_FILE` - User data file (default: ./auth.json)
- `FRONTEND_URL` - Frontend URL for CORS (default: http://localhost:3000)
- `VITE_API_URL` - Backend URL (default: http://localhost:3001)
