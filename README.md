# mcp-tavily-bridge

English | [中文](README.zh-CN.md)

MCP server that proxies the official `tavily-mcp` tool surface, while rotating across a pool of upstream Tavily API keys managed via an admin UI.

## Quickstart (Local)

### Docker Compose (recommended)

```bash
cp .env.example .env
docker compose up --build
```

SQLite data is stored in the Docker volume mounted at `/data`.

Then open:
- Admin UI: `http://localhost:8787/admin`
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

Requires the env vars in `.env.example` (at minimum: `DATABASE_URL`, `ADMIN_API_TOKEN`, `KEY_ENCRYPTION_SECRET`). `DATABASE_URL` should be a SQLite file URL (for example `file:./tavily_bridge.db`).

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

## Brave Search MCP compatibility

This bridge also exposes Brave Search-compatible tools (in addition to the Tavily tool surface):

- `brave_web_search`
- `brave_local_search` (may fall back to web search depending on Brave plan support)

### Brave configuration

If `BRAVE_API_KEY` is set, Brave tools call the Brave Search API. If it is not set, Brave tools **fall back to Tavily** (results are formatted into a Brave-compatible JSON array).

To mitigate Brave free-tier limits (1 request/second), Brave requests are queued and rate-gated across concurrent MCP sessions:

- `BRAVE_API_KEY`: Brave Search API key (optional; enables upstream Brave calls)
- `BRAVE_MAX_QPS`: max requests/second allowed to Brave (default: `1`)
- `BRAVE_MIN_INTERVAL_MS`: overrides `BRAVE_MAX_QPS` with a fixed minimum interval between requests
- `BRAVE_MAX_QUEUE_MS`: max time a Brave request may wait in the queue before error/fallback (default: `30000`)
- `BRAVE_OVERFLOW`: `fallback_to_tavily` (default) | `queue` | `error`
- `BRAVE_HTTP_TIMEOUT_MS`: per-request Brave HTTP timeout (default: `20000`)

## Tavily Usage Logging

The bridge can record what Tavily is being used for (per-tool usage events) and expose it in the Admin UI under **Usage**.

Privacy defaults to storing a query hash + a redacted preview (not full plaintext). Configure via env vars:

- `TAVILY_USAGE_LOG_MODE`: `none|hash|preview|full` (default: `preview`)
- `TAVILY_USAGE_HASH_SECRET`: optional; when set, `queryHash` is `HMAC-SHA256` (recommended)
- `TAVILY_USAGE_SAMPLE_RATE`: optional `0..1` sampling rate
- `TAVILY_USAGE_RETENTION_DAYS`: optional retention window (enables cleanup)
- `TAVILY_USAGE_CLEANUP_PROBABILITY`: optional; cleanup trigger probability per logged event (default: `0.001`)

## Upstream Key Selection

When multiple upstream Tavily API keys are available, the bridge can pick a key per request using one of these strategies:

- `TAVILY_KEY_SELECTION_STRATEGY`: `round_robin` (default) or `random`

You can also override this at runtime from the Admin UI (**Settings → Server**) which persists on the server and takes effect immediately.

## Search Source Mode

The bridge can query Tavily, Brave, or both. You can control this behavior using one of four modes:

- `tavily_only`: Only use the Tavily Search API.
- `brave_only`: Only use the Brave Search API. Requires `BRAVE_API_KEY` to be set.
- `combined`: Query both APIs in parallel and merge the results, deduplicating by URL.
- `brave_prefer_tavily_fallback`: (Default) Try Brave Search first, and fall back to Tavily on error.

Configure via the Admin UI (**Settings → Server**) which persists on the server and takes effect immediately.
