FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json tsconfig.json tsconfig.base.json ./
COPY packages/core/package.json packages/core/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/bridge-server/package.json packages/bridge-server/package.json
COPY packages/bridge-stdio/package.json packages/bridge-stdio/package.json
COPY packages/admin-ui/package.json packages/admin-ui/package.json

RUN npm ci

COPY . .

RUN npm -w @mcp-tavily-bridge/db run prisma:generate
RUN npm run build

FROM node:20-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app /app

EXPOSE 8787

CMD ["node", "packages/bridge-server/dist/index.js"]
