# Apex OS — deployment plan slice 8.
#
# One image serves everything on one origin: the API, the staff app at /app, the
# field console at /, and the customer progress page at /c/<token>. That is not
# a packaging convenience — it is why the staff app needs no CORS, no dev proxy,
# and no second deployment to keep in step with the API it calls.

# ---------------------------------------------------------------- build stage
FROM node:24-bookworm-slim AS build

# Corepack ships with Node and pins pnpm from packageManager in package.json, so
# the image cannot drift from the version CI and the lockfile were built with.
RUN corepack enable

WORKDIR /app

# Manifests first, so a source-only change reuses the cached install layer.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/contracts/package.json packages/contracts/
COPY packages/domain/package.json packages/domain/
COPY packages/database/package.json packages/database/
COPY packages/storage/package.json packages/storage/
COPY packages/gate-service/package.json packages/gate-service/
COPY apps/gate-api/package.json apps/gate-api/
COPY apps/apex-os/package.json apps/apex-os/
COPY ["Apex Designer/package.json", "Apex Designer/package-lock.json", "Apex Designer/"]

RUN pnpm install --frozen-lockfile
RUN cd "Apex Designer" && npm ci --ignore-scripts

COPY . .

# `typecheck` is what emits dist/ for the workspace packages — the same ordering
# trap that broke CI, and the reason the app build runs after it rather than
# beside it.
RUN pnpm typecheck && pnpm --filter @apex/os build \
  && rm -rf "Apex Designer/node_modules"

# -------------------------------------------------------------- runtime stage
FROM node:24-bookworm-slim AS runtime

RUN corepack enable
ENV NODE_ENV=production

WORKDIR /app

# The whole tree, then dev dependencies pruned. Copying the built workspace
# wholesale keeps pnpm's symlinked layout intact; reconstructing it in the
# runtime stage is where these Dockerfiles usually go wrong.
COPY --from=build /app /app
RUN pnpm prune --prod && pnpm store prune || true

# Bind every interface: the platform reaches the container from outside it.
# `main.ts` refuses to start with GATE_LOCAL_USER on a non-loopback bind, so
# this line and the tokenless local bypass are mutually exclusive by design.
ENV HOST=0.0.0.0
ENV PORT=4100

# The built staff app, stated rather than inferred from a relative path across
# package boundaries.
ENV APEX_APP_DIR=/app/apps/apex-os/dist

# The local evidence fallback needs somewhere it can actually write.
#
# `main.ts` permits that fallback whenever no object storage is configured, but
# /app is root-owned from the build stage, so a non-root process cannot create
# its own evidence directory. The failure is silent and expensive to diagnose:
# the app boots perfectly, serves requests, and reports evidence:false from
# /ready forever — so the platform never routes traffic and the deploy times out
# fifteen minutes later with a healthy process running inside it.
#
# That is exactly what happened on the first real deploy, 2026-08-06.
#
# This makes the fallback work; it does not make it good. Evidence on a
# container filesystem is erased by the next deploy. Object storage is the only
# configuration fit for a real job — see docs/runbooks/deployment.md §1.
RUN mkdir -p /app/var/gate-evidence && chown -R node:node /app/var

# node, not root.
USER node

EXPOSE 4100

# Readiness — not liveness — because this answers "can it serve", which is the
# question a platform routing traffic is actually asking. It checks the database
# and evidence storage and answers 503 when either is gone.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4100)+'/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "apps/gate-api/dist/main.js"]
