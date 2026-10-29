FROM node:24-alpine AS base
RUN corepack enable && corepack prepare pnpm@12.6.0 --activate
WORKDIR /app

FROM base AS dependencies
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY tsconfig.base.json ./
COPY packages/compartido/package.json ./packages/compartido/
COPY apps/agente-local/package.json ./apps/agente-local/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
RUN pnpm install --frozen-lockfile || pnpm install

COPY packages/compartido ./packages/compartido
RUN pnpm --filter @caprichos/compartido build

COPY apps/api ./apps/api
WORKDIR /app/apps/api
RUN pnpm prisma:generate
RUN pnpm build

FROM node:24-alpine AS runner
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@12.6.0 --activate
ENV NODE_ENV=production

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY tsconfig.base.json ./
COPY packages/compartido/package.json ./packages/compartido/
COPY packages/compartido/dist ./packages/compartido/dist
COPY apps/api/package.json ./apps/api/
COPY apps/api/prisma ./apps/api/prisma
RUN pnpm install --prod --frozen-lockfile || pnpm install --prod

COPY --from=dependencies /app/apps/api/dist ./apps/api/dist
COPY --from=dependencies /app/node_modules/.prisma ./node_modules/.prisma

WORKDIR /app/apps/api
EXPOSE 3000
CMD ["node", "dist/main.js"]
