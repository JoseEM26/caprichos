FROM node:24-alpine AS base
RUN corepack enable && corepack prepare pnpm@12.6.0 --activate
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY tsconfig.base.json ./
COPY packages/compartido/package.json ./packages/compartido/
COPY apps/agente-local/package.json ./apps/agente-local/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
RUN pnpm install --frozen-lockfile || pnpm install

COPY packages/compartido ./packages/compartido
RUN pnpm --filter @caprichos/compartido build

COPY apps/web ./apps/web
WORKDIR /app/apps/web
RUN pnpm build

FROM node:24-alpine AS runner
WORKDIR /app
# parche de seguridad (CVE-2026-111497): la 1.2.1 solo esta en edge; se quita cuando la rama estable la traiga
RUN apk add --no-cache --upgrade --repository=https://dl-cdn.alpinelinux.org/alpine/edge/main brotli-libs
RUN corepack enable && corepack prepare pnpm@12.6.0 --activate
COPY --from=base /app/apps/web/dist ./dist
RUN npm install -g serve
EXPOSE 5173
CMD ["serve", "-s", "dist", "-l", "5173"]
