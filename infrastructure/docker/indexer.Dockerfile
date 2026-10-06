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
COPY apps/indexer apps/indexer
RUN npm run build -w @besu-net/shared -w @besu-net/db -w @besu-net/indexer

FROM node:20-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app /app
EXPOSE 4100
CMD ["node", "apps/indexer/dist/main.js"]
