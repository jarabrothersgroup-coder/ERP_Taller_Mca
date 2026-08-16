# ─────────────────────────────────────────────────────────
# AutomotiveOS Cloud ERP — Web Frontend (Next.js 16)
# ─────────────────────────────────────────────────────────
# Multi-stage build. Mirrors the backend Dockerfile conventions:
#   - node:22-alpine
#   - non-root user (uid 1001)
#   - explicit HEALTHCHECK
#
# Build:  podman build -t automotiveos/erp-web:latest -f web/Dockerfile web
# Run:    podman run -p 3100:3000 -e BACKEND_HOST=erp -e BACKEND_PORT=3000 automotiveos/erp-web:latest
#
# BACKEND_HOST / BACKEND_PORT control the API rewrite target (next.config.mjs)
# and are passed both at build time (baked into the compiled rewrites) and at
# runtime (the server re-reads next.config). In the compose network the backend
# is reachable as `erp` on port 3000.
# ─────────────────────────────────────────────────────────

# ─── Stage 1: Dependencies ──────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# ─── Stage 2: Build ─────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .

ARG BACKEND_HOST=erp
ARG BACKEND_PORT=3000
ENV BACKEND_HOST=${BACKEND_HOST} BACKEND_PORT=${BACKEND_PORT} NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ─── Stage 3: Production ────────────────────────────────
FROM node:22-alpine AS production
WORKDIR /app

# Security: non-root user
RUN addgroup -g 1001 nextjs && adduser -u 1001 -G nextjs -s /bin/sh -D nextjs

ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000

# Runtime deps only (next, next-intl, react, etc.)
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/package.json ./
COPY --from=build /app/next.config.mjs ./
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/messages ./messages
COPY --from=build /app/src/i18n ./src/i18n

# Healthcheck — the web proxies /health/* to the backend, so a 200 from
# /health/live proves web + proxy + backend are all up.
HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=30s \
  CMD node -e "require('http').get('http://localhost:3000/health/live', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

USER nextjs
EXPOSE 3000

CMD ["npm", "run", "start"]
