FROM oven/bun:latest AS base
WORKDIR /app

# Install dependencies
FROM base AS installer
# Copy root configuration and workspace configs
COPY package.json bun.lock ./
COPY apps/admin-ui/package.json ./apps/admin-ui/
COPY apps/bot-engine/package.json ./apps/bot-engine/
# Install production dependencies for the entire monorepo
RUN bun install --frozen-lockfile --production

# Production runner
FROM base AS runner
ENV NODE_ENV=production

# Copy installed dependencies and source code
COPY --from=installer --chown=bun:bun /app/node_modules ./node_modules
COPY --chown=bun:bun apps/bot-engine ./apps/bot-engine

# Create database directory with correct permissions for SQLite
RUN mkdir -p /app/apps/bot-engine/data && chown -R bun:bun /app/apps/bot-engine/data

USER bun
EXPOSE 4000
WORKDIR /app/apps/bot-engine
ENTRYPOINT [ "bun", "src/index.js" ]
