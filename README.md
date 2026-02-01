# mcp-tavily-bridge

English | [中文](README.zh-CN.md)

MCP server that proxies the official `tavily-mcp` tool surface, while rotating across a pool of upstream Tavily API keys managed via an admin UI.

## Quickstart (Local)

### Docker Compose (recommended)

```bash
cp .env.example .env
docker compose up --build
```

Then open:
- Admin UI: `http://localhost:8787/admin-ui`
- MCP endpoint: `http://localhost:8787/mcp`

## Workspace

- `packages/core`: shared schemas/formatting + Tavily client + key rotation
- `packages/bridge-server`: Streamable HTTP MCP server + Admin API (+ serves admin UI)
- `packages/bridge-stdio`: stdio MCP server (same tools)
- `packages/db`: Prisma schema + DB client
- `packages/admin-ui`: admin UI (scaffold)

## Deployment

- Local/self-hosted (Docker Compose): see `docker-compose.yml`.

### Local quickstart (Node)

Requires a Postgres database and the env vars in `.env.example` (at minimum: `DATABASE_URL`, `ADMIN_API_TOKEN`, `KEY_ENCRYPTION_SECRET`).

```bash
npm install
npx prisma migrate deploy --schema packages/db/prisma/schema.prisma
npm run dev:bridge-server
```

## Connect an MCP client

1. Open the Admin UI and create a **client token** (`Tokens` page).
2. Use that client token to authenticate MCP requests (this is different from the **admin token** used to access the Admin UI).

### HTTP

- MCP endpoint: `POST /mcp`
- Auth: `Authorization: Bearer <client_token>`

### stdio

Recommended: run a lightweight stdio wrapper via `npx` that connects to the HTTP MCP endpoint (keep secrets in `env`, not args):

Set `TAVILY_BRIDGE_BASE_URL` to your deployment URL (for local Docker Compose: `http://localhost:8787`).

```json
{
  "mcpServers": {
    "tavily-bridge": {
      "command": "npx",
      "args": ["-y", "@mcp-tavily-bridge/stdio-http-bridge"],
      "env": {
        "TAVILY_BRIDGE_BASE_URL": "http://localhost:8787",
        "TAVILY_BRIDGE_MCP_TOKEN": "<client_token>"
      }
    }
  }
}
```

## Tavily Usage Logging

The bridge can record what Tavily is being used for (per-tool usage events) and expose it in the Admin UI under **Usage**.

Privacy defaults to storing a query hash + a redacted preview (not full plaintext). Configure via env vars:

- `TAVILY_USAGE_LOG_MODE`: `none|hash|preview|full` (default: `preview`)
- `TAVILY_USAGE_HASH_SECRET`: optional; when set, `queryHash` is `HMAC-SHA256` (recommended)
- `TAVILY_USAGE_SAMPLE_RATE`: optional `0..1` sampling rate
- `TAVILY_USAGE_RETENTION_DAYS`: optional retention window (enables cleanup)
- `TAVILY_USAGE_CLEANUP_PROBABILITY`: optional; cleanup trigger probability per logged event (default: `0.001`)
