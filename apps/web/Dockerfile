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
# parche de seguridad (CVE-2026-111497) hasta que la imagen base lo traiga
RUN apk upgrade --no-cache brotli-libs
RUN corepack enable && corepack prepare pnpm@12.6.0 --activate
COPY --from=base /app/apps/web/dist ./dist
RUN npm install -g serve
EXPOSE 5173
CMD ["serve", "-s", "dist", "-l", "5173"]
