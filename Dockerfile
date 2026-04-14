FROM node:20-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*
RUN corepack enable pnpm
WORKDIR /app

# The entire monorepo context
COPY . .

# Global install to set up all links correctly
RUN pnpm install --frozen-lockfile

# Build everything exactly as in CLI
RUN pnpm --filter @kanban/shared build
RUN pnpm --filter @kanban/web --prod build
RUN pnpm --filter @kanban/api --prod build

# Deploy individual apps
RUN pnpm --filter @kanban/web --prod deploy --legacy /app/web-deployed
RUN pnpm --filter @kanban/api --prod deploy --legacy /app/api-deployed

# --- Web Runtime ---
FROM node:20-slim AS web
WORKDIR /app
ENV NODE_ENV=production
COPY --from=base /app/web-deployed ./
COPY --from=base /app/apps/web/.next/standalone ./
COPY --from=base /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=base /app/apps/web/public ./apps/web/public
EXPOSE 3000
CMD ["node", "apps/web/server.js"]

# --- API Runtime ---
FROM node:20-slim AS api
WORKDIR /app
ENV NODE_ENV=production
COPY --from=base /app/api-deployed ./
COPY --from=base /app/apps/api/dist ./dist
EXPOSE 3001
CMD ["node", "dist/index.js"]
