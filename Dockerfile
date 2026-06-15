# ─────────────────────────────────────────────────────────
# AutomotiveOS Cloud ERP — Multi-stage Dockerfile
# Target: <50 MB RAM runtime, ESM native, Alpine-based
# ─────────────────────────────────────────────────────────

# ─── Stage 1: Build ──────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Build-time essentials (if native addons needed)
RUN apk add --no-cache python3 make g++

# Dependency manifests first (layer caching)
COPY package*.json ./
RUN npm ci

# Source code
COPY . .

# Compile TypeScript → JS, copy static assets (tv-template, SPA)
RUN npm run build

# ─── Stage 2: Production Runtime ─────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0

# Runtime OS deps: Bluetooth for thinkcar, SSL certs, timezone
RUN apk add --no-cache bluez ca-certificates tzdata

# Production dependencies only
COPY package*.json ./
RUN npm ci --only=production --ignore-scripts

# Compiled code + static assets from builder
COPY --from=builder /app/dist ./dist

# Expose Fastify port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Run with GC tuning for <50 MB heap target
CMD ["node", "--expose-gc", "--max-old-space-size=48", "--optimize-for-size", "--gc-interval=100", "dist/app.js"]
