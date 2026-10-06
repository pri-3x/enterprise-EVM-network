FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
COPY apps/api/package.json apps/api/
COPY apps/indexer/package.json apps/indexer/
COPY apps/frontend/package.json apps/frontend/
COPY contracts/package.json contracts/
RUN npm ci
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY packages/db packages/db
COPY apps/api apps/api
# npm runs multiple -w scripts in parallel. The API build must see shared's
# emitted .d.ts files, so these stay sequential.
RUN npm run build -w @besu-net/shared \
 && npm run build -w @besu-net/db \
 && npm run build -w @besu-net/api

FROM node:20-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app /app
EXPOSE 4000
CMD ["node", "apps/api/dist/server.js"]
