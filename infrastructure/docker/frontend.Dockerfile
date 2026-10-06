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
COPY apps/frontend apps/frontend
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ARG NEXT_PUBLIC_NETWORK_NAME="Enterprise Besu Network"
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_NETWORK_NAME=$NEXT_PUBLIC_NETWORK_NAME
RUN npm run build -w @besu-net/frontend

FROM node:20-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app /app
EXPOSE 3000
CMD ["npm", "run", "start", "-w", "@besu-net/frontend"]
