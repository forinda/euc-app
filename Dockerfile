# syntax=docker/dockerfile:1
# Live Poll: KickJS API + Socket.IO + the built React app, one Node process.
# Needs an always-on host (Render, Fly.io, Railway, a VPS): Socket.IO and the
# in-memory session store don't work on serverless functions.

ARG NODE_VERSION=22

# ---- build: install everything, typegen, build server + web ----------------
FROM node:${NODE_VERSION}-slim AS build
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /repo

# Manifests first so the dependency layer caches across source-only changes.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY server/package.json server/
COPY web/package.json web/
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

# Server's production dependencies only, in a self-contained folder.
RUN pnpm --filter ./server deploy --prod --legacy /out/server \
 && cp -r server/dist /out/server/dist \
 && cp -r web/dist /out/web

# ---- runtime: production deps + build output, no toolchain ----------------
FROM node:${NODE_VERSION}-slim AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    CLIENT_DIR=/app/web
WORKDIR /app/server
COPY --from=build --chown=node:node /out/server /app/server
COPY --from=build --chown=node:node /out/web /app/web
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/v1/hello/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/index.js"]
