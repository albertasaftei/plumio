# Backend Dockerfile
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files (need pnpm-lock.yaml too)
COPY package.json pnpm-lock.yaml ./

# Install pnpm and dependencies
RUN npm install -g pnpm && pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build TypeScript
RUN pnpm build

# Production stage
FROM node:22-alpine

WORKDIR /app

# Copy built files and dependencies
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-lock.yaml ./

# Install pnpm and production dependencies
RUN npm install -g pnpm && pnpm install --prod --frozen-lockfile

# Create directories for data
RUN mkdir -p /data/documents

EXPOSE 3001

CMD ["node", "dist/index.js"]
