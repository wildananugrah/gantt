FROM oven/bun:1.3-alpine

WORKDIR /app

# Copy workspace root files needed for `bun install` from any package
COPY package.json bun.lock bunfig.toml tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/package.json
COPY packages/server/package.json ./packages/server/package.json

# Install deps (workspace install resolves @app/shared as workspace:*)
RUN bun install --frozen-lockfile

# Copy source
COPY packages/shared ./packages/shared
COPY packages/server ./packages/server

WORKDIR /app/packages/server

ENV NODE_ENV=production
EXPOSE 3000

CMD ["bun", "run", "src/index.ts"]
