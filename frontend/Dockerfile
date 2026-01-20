# Frontend Dockerfile
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install pnpm and dependencies
RUN npm install -g pnpm && pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
RUN pnpm build

# Production stage
FROM node:22-alpine

WORKDIR /app

# Copy built files and dependencies
COPY --from=builder /app/.output ./.output
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-lock.yaml ./

# Install pnpm and production dependencies
RUN npm install -g pnpm && pnpm install --prod --frozen-lockfile

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
