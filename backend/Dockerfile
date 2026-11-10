# syntax=docker/dockerfile:1
# One image: the API + the website it serves.
# Build with the app as a named context:  docker build --build-context app=../mobile .
# (deploy/docker-compose.yml does this for you.)

# ---- 1. Website: export the Expo app for the web --------------------------------
FROM node:22-bookworm-slim AS web
WORKDIR /app
ENV CI=1 EXPO_NO_TELEMETRY=1
COPY --from=app package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY --from=app . .
# The site is served by the API itself, so it calls it on the same origin.
RUN EXPO_PUBLIC_WEB_API_URL=/api npx expo export --platform web --output-dir dist

# ---- 2. API production dependencies ---------------------------------------------
FROM node:22-bookworm-slim AS deps
WORKDIR /srv
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

# ---- 3. Runtime ------------------------------------------------------------------
FROM node:22-bookworm-slim
ENV NODE_ENV=production PORT=3000 WEB_DIST_DIR=/srv/web
WORKDIR /srv
COPY --from=deps /srv/node_modules ./node_modules
COPY package.json ./
COPY src ./src
COPY db ./db
COPY scripts ./scripts
COPY --from=web /app/dist ./web

USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Bring the database up to date, then serve.
CMD ["sh", "-c", "node scripts/migrate.js && exec node src/server.js"]
