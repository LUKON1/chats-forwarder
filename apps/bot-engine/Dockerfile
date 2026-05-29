FROM node:22-slim AS base
WORKDIR /app

# Production-only dependencies installer
FROM base AS prod-installer
COPY apps/bot-engine/package.json ./apps/bot-engine/
RUN cd apps/bot-engine && npm install --omit=dev --no-audit --no-fund

# All dependencies installer (for dev)
FROM base AS installer
COPY apps/bot-engine/package.json ./apps/bot-engine/
RUN cd apps/bot-engine && npm install --no-audit --no-fund

# Development stage
FROM installer AS dev
ENV NODE_ENV=development
WORKDIR /app/apps/bot-engine
EXPOSE 4000
ENTRYPOINT [ "npm", "run", "dev" ]

# Production runner
FROM base AS runner
ENV NODE_ENV=production

# Copy source code and production-only node_modules
COPY --chown=node:node apps/bot-engine ./apps/bot-engine
COPY --from=prod-installer --chown=node:node /app/apps/bot-engine/node_modules ./apps/bot-engine/node_modules

# Create database directory with correct permissions for SQLite
RUN mkdir -p /app/apps/bot-engine/data && chown -R node:node /app/apps/bot-engine/data

USER node
EXPOSE 4000
WORKDIR /app/apps/bot-engine
ENTRYPOINT [ "node", "--experimental-sqlite", "src/index.js" ]


