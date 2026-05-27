FROM node:22-slim AS base
WORKDIR /app

# Install dependencies
FROM base AS installer
COPY apps/bot-engine/package.json ./apps/bot-engine/
RUN cd apps/bot-engine && npm install --omit=dev --no-audit --no-fund

# Production runner
FROM base AS runner
ENV NODE_ENV=production

# Copy source code and pre-installed node_modules
COPY --chown=node:node apps/bot-engine ./apps/bot-engine
COPY --from=installer --chown=node:node /app/apps/bot-engine/node_modules ./apps/bot-engine/node_modules

# Create database directory with correct permissions for SQLite
RUN mkdir -p /app/apps/bot-engine/data && chown -R node:node /app/apps/bot-engine/data

USER node
EXPOSE 4000
WORKDIR /app/apps/bot-engine
ENTRYPOINT [ "node", "src/index.js" ]
