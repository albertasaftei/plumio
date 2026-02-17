# Multi-stage build for Plumio - Combined Frontend & Backend
FROM node:22-alpine AS frontend-builder

ARG APP_VERSION=dev
ARG GIT_COMMIT=unknown
ARG GIT_BRANCH=unknown
ARG BUILD_DATE=unknown

ENV VITE_APP_VERSION=${APP_VERSION}
ENV VITE_GIT_COMMIT=${GIT_COMMIT}
ENV VITE_GIT_BRANCH=${GIT_BRANCH}
ENV VITE_BUILD_DATE=${BUILD_DATE}

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
RUN npm ci

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

# Create data directory
RUN mkdir -p /data/documents

# Environment variables
ENV NODE_ENV=production
ENV BACKEND_INTERNAL_PORT=3001
ENV DOCUMENTS_PATH=/data/documents
ENV DB_PATH=/data/plumio.db

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=10m --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/health || exit 1

# Copy and set up start script
COPY ./start.sh /app/start.sh
RUN chmod +x /app/start.sh

CMD ["sh", "/app/start.sh"]
