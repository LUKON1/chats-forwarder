FROM oven/bun:latest AS base
WORKDIR /app

# Install dependencies
FROM base AS installer
# Copy root configuration and workspace configs
COPY package.json bun.lock ./
COPY apps/admin-ui/package.json ./apps/admin-ui/
COPY apps/bot-engine/package.json ./apps/bot-engine/
# Install dependencies for the entire monorepo
RUN bun install --frozen-lockfile

# Build the app
FROM base AS builder
COPY --from=installer /app/node_modules ./node_modules
COPY package.json bun.lock ./
COPY apps/admin-ui ./apps/admin-ui
# Set environment variables for build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN cd apps/admin-ui && bun run build

# Production runner
FROM base AS runner
ENV NODE_ENV=production

COPY --from=builder --chown=bun:bun /app/apps/admin-ui/.next/standalone ./
COPY --from=builder --chown=bun:bun /app/apps/admin-ui/public ./apps/admin-ui/public
COPY --from=builder --chown=bun:bun /app/apps/admin-ui/.next/static ./apps/admin-ui/.next/static

USER bun
EXPOSE 3000
ENTRYPOINT ["bun", "apps/admin-ui/server.js"]
