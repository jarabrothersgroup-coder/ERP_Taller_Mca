# ─────────────────────────────────────────────────────────
# AutomotiveOS Cloud ERP — Dockerfile (Production)
# ─────────────────────────────────────────────────────────
# Multi-stage build para imagen ligera (~150MB vs ~1GB dev)
#
# Build:  docker build -t erp-backend .
# Run:    docker run -p 3000:3000 --env-file .env erp-backend
# ─────────────────────────────────────────────────────────

# ─── Stage 1: Dependencies ──────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# ─── Stage 2: Build ─────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npx tsc

# ─── Stage 3: Production ────────────────────────────────
FROM node:22-alpine AS production
WORKDIR /app

# Security: non-root user
RUN addgroup -g 1001 erp && adduser -u 1001 -G erp -s /bin/sh -D erp

# Storage dir writable by the non-root user (empty volumes copy up this
# directory's ownership on first mount, so uploads work in rootless Podman)
RUN mkdir -p /data/erp-storage \
  && mkdir -p /app/assets/uploads /app/backups /app/.rate-limit /app/config \
  && chown -R erp:erp /data/erp-storage /app/assets /app/backups /app/.rate-limit /app/config

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./
COPY engram.json ./

# Runtime files read from process.cwd() (see src/app.ts, config plugin,
# tenant settings, rate-limiter store)
COPY src/shared/public ./src/shared/public
COPY config ./config

# Copy static frontend assets (mirrors npm run build: tsc && cp tv-template.html)
COPY src/shared/public ./dist/shared/public
COPY src/modules/intelligence/visual/tv-template.html ./dist/modules/intelligence/visual/tv-template.html

# Health check — /health/live is the public liveness probe (always 200 when
# the server is up). /health and /api/v1/health require auth / don't exist.
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:3000/health/live || exit 1

USER erp
EXPOSE 3000

CMD ["node", "dist/app.js"]
