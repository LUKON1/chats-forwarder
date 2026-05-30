FROM oven/bun:latest AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME="0.0.0.0"
ENV PORT=3000

# Install dependencies
FROM base AS installer
COPY package.json bun.lock ./
COPY apps/admin-ui/package.json ./apps/admin-ui/
COPY apps/bot-engine/package.json ./apps/bot-engine/
RUN bun install

# Build the app
FROM base AS builder
ARG BACKEND_URL
ENV BACKEND_URL=$BACKEND_URL
COPY --from=installer /app ./
COPY apps/admin-ui ./apps/admin-ui
RUN cd apps/admin-ui && bun run build

# Development stage
FROM installer AS dev
ENV NODE_ENV=development
EXPOSE 3000
ENTRYPOINT ["bun", "--cwd", "apps/admin-ui", "dev"]

# Production runner
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME="0.0.0.0"
ENV PORT=3000

COPY --from=builder --chown=node:node /app/apps/admin-ui/.next/standalone ./
COPY --from=builder --chown=node:node /app/apps/admin-ui/public ./apps/admin-ui/public
COPY --from=builder --chown=node:node /app/apps/admin-ui/.next/static ./apps/admin-ui/.next/static

USER node
EXPOSE 3000
ENTRYPOINT ["node", "apps/admin-ui/server.js"]

