FROM oven/bun:latest AS base
WORKDIR /app

# Install dependencies
FROM base AS installer
COPY apps/bot-engine/package.json ./apps/bot-engine/
RUN cd apps/bot-engine && bun install --production --no-frozen-lockfile

# Production runner
FROM base AS runner
ENV NODE_ENV=production

# Copy source code and pre-installed node_modules
COPY --chown=bun:bun apps/bot-engine ./apps/bot-engine
COPY --from=installer --chown=bun:bun /app/apps/bot-engine/node_modules ./apps/bot-engine/node_modules

# Create database directory with correct permissions for SQLite
RUN mkdir -p /app/apps/bot-engine/data && chown -R bun:bun /app/apps/bot-engine/data

USER bun
EXPOSE 4000
WORKDIR /app/apps/bot-engine
ENTRYPOINT [ "bun", "src/index.js" ]
