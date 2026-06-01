FROM node:22-slim AS base
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Production-only dependencies installer
FROM base AS prod-installer
COPY apps/bot-engine/package.json ./apps/bot-engine/
COPY apps/bot-engine/prisma ./apps/bot-engine/prisma
RUN cd apps/bot-engine && npm install --omit=dev --no-audit --no-fund && npx prisma generate

# All dependencies installer (for dev)
FROM base AS installer
COPY apps/bot-engine/package.json ./apps/bot-engine/
COPY apps/bot-engine/prisma ./apps/bot-engine/prisma
RUN cd apps/bot-engine && npm install --no-audit --no-fund && npx prisma generate

# Development stage
FROM installer AS dev
ENV NODE_ENV=development
WORKDIR /app/apps/bot-engine
EXPOSE 4000
ENTRYPOINT [ "sh", "-c", "npx prisma db push && npm run dev" ]

# Production runner
FROM base AS runner
ENV NODE_ENV=production

# Copy source code and production-only node_modules
COPY --chown=node:node apps/bot-engine ./apps/bot-engine
COPY --from=prod-installer --chown=node:node /app/apps/bot-engine/node_modules ./apps/bot-engine/node_modules

USER node
EXPOSE 4000
WORKDIR /app/apps/bot-engine
ENTRYPOINT [ "sh", "-c", "npx prisma db push && node src/index.js" ]


