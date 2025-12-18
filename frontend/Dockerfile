# BizPilot Frontend Dockerfile (Production)
FROM node:20-alpine AS builder

WORKDIR /repo

# Install pnpm
RUN npm install -g pnpm

# Copy workspace manifests + package manifests needed for dependency resolution
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY frontend/package.json ./frontend/package.json
COPY shared/package.json ./shared/package.json

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy application code
COPY frontend ./frontend
COPY shared ./shared

# Build the application
RUN pnpm --filter frontend build

# Production image
FROM node:20-alpine AS runner

WORKDIR /repo

ENV NODE_ENV=production

# Install pnpm
RUN npm install -g pnpm

# Copy workspace manifests + package manifests needed for dependency resolution
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY frontend/package.json ./frontend/package.json
COPY shared/package.json ./shared/package.json

# Install production dependencies for the frontend workspace only
RUN pnpm --filter frontend --prod install --frozen-lockfile

# Copy built application from builder
COPY --from=builder /repo/frontend/.next ./frontend/.next
COPY --from=builder /repo/frontend/public ./frontend/public
COPY --from=builder /repo/frontend/next.config.mjs ./frontend/next.config.mjs

# Expose port
EXPOSE 3000

# Run the application
CMD ["pnpm", "--filter", "frontend", "start"]
