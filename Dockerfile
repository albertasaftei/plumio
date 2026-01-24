# Multi-stage build for Pluma - Combined Frontend & Backend
FROM node:22-alpine AS frontend-builder

# Install pnpm
RUN npm install -g pnpm

# Build frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY frontend/src ./src
COPY frontend/public ./public
COPY frontend/app.config.ts frontend/tsconfig.json frontend/uno.config.ts ./
RUN pnpm build

# Backend builder stage
FROM node:22-alpine AS backend-builder

# Install dependencies needed for native modules (bcrypt, better-sqlite3)
RUN apk add --no-cache python3 make g++

WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json* ./
RUN npm install

COPY backend/src ./src
COPY backend/tsconfig.json ./
RUN npm run build

# Final production stage
FROM node:22-alpine

# Install runtime dependencies for native modules
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy backend
COPY --from=backend-builder /app/backend/dist ./backend/dist
COPY --from=backend-builder /app/backend/node_modules ./backend/node_modules
COPY --from=backend-builder /app/backend/package.json ./backend/
COPY backend/src/db/schema.sql ./backend/dist/db/

# Copy frontend build
COPY --from=frontend-builder /app/frontend/.output ./frontend/.output
COPY --from=frontend-builder /app/frontend/package.json ./frontend/
COPY --from=frontend-builder /app/frontend/pnpm-lock.yaml ./frontend/

# Install pnpm for frontend runtime
RUN npm install -g pnpm && cd frontend && pnpm install --prod --frozen-lockfile

# Create data directory
RUN mkdir -p /data/documents

# Environment variables
ENV NODE_ENV=production
ENV PORT=3001
ENV DOCUMENTS_PATH=/data/documents
ENV DB_PATH=/data/pluma.db

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/health || exit 1

# Start both frontend and backend
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

CMD ["/app/start.sh"]
