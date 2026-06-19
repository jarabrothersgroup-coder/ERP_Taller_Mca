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
RUN npx tsc --noEmit 2>/dev/null; npx tsc

# ─── Stage 3: Production ────────────────────────────────
FROM node:22-alpine AS production
WORKDIR /app

# Security: non-root user
RUN addgroup -g 1001 erp && adduser -u 1001 -G erp -s /bin/sh -D erp

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./
COPY engram.json ./

# Copy static frontend assets
COPY src/shared/public ./dist/shared/public

# Health check
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/v1/health || exit 1

USER erp
EXPOSE 3000

CMD ["node", "dist/app.js"]
