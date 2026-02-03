# mcp-nexus

English | [中文](README.zh-CN.md)

`mcp-nexus` is a robust, multi-provider Model Context Protocol (MCP) server that acts as a bridge for both **Tavily** and **Brave Search** APIs. It provides a unified tool surface, rotating across a pool of upstream API keys, all managed through a comprehensive Admin UI.

## Features

-   **Unified Search APIs**: Exposes tools for both Tavily and Brave Search through a single MCP endpoint.
-   **API Key Management**: Easily add, manage, and rotate multiple Tavily and Brave API keys to distribute load and handle rate limits.
-   **Client Authentication**: Secure the MCP endpoint with bearer tokens that can be created and revoked via the Admin UI.
-   **Web Admin UI**: A user-friendly interface to manage API keys, client tokens, view usage statistics, and configure server settings.
-   **Usage Monitoring**: Track tool usage, inspect query history, and get summaries of your most used tools and queries.
-   **Flexible Search Strategy**: Dynamically configure the search source (`tavily_only`, `brave_only`, `combined`, etc.) and key selection strategy (`round_robin`, `random`) without restarting the server.
-   **Rate Limiting**: Built-in rate limiting for both MCP clients and upstream API calls to prevent abuse and manage costs.
-   **Flexible Deployment**: Run locally with Node.js or deploy anywhere using the provided Docker Compose setup.

## Quickstart (Local)

### Docker Compose (recommended)

```bash
cp .env.example .env
# Edit .env to set your ADMIN_API_TOKEN and other configurations
docker compose up --build
```

SQLite data is stored in the Docker volume mounted at `/data`.

Then open:
-   Admin UI: `http://localhost:8787/admin`
-   MCP endpoint: `http://localhost:8787/mcp`

### Local Node.js

Requires the env vars in `.env.example` to be set.

```bash
npm install
npx prisma migrate deploy --schema packages/db/prisma/schema.prisma
npm run dev:bridge-server
```

## Workspace

-   `packages/core`: Core logic for Tavily/Brave clients, key management, and MCP tool schemas.
-   `packages/bridge-server`: The main HTTP server, providing the MCP endpoint and the Admin API/UI.
-   `packages/bridge-stdio`: A lightweight stdio server for local client integration.
-   `packages/stdio-http-bridge`: A helper package to connect stdio clients to the HTTP server.
-   `packages/db`: Prisma schema and database client for all data persistence.
-   `packages/admin-ui`: The React-based Admin UI frontend.

## Admin UI

The Admin UI provides a central place to manage your `mcp-nexus` instance.

-   **Keys**: Manage your pool of upstream **Tavily** and **Brave** API keys. You can add, remove, update the status (active, disabled), and monitor the remaining credits for Tavily keys.
-   **Tokens**: Create and revoke client tokens used to authenticate with the MCP endpoint.
-   **Usage**: View detailed tool usage statistics and query history, with options to filter by date range, tool, and client.
-   **Settings**: Configure live server settings, such as the upstream key selection strategy and the search source mode.

## MCP Tools

The server exposes the following tools to MCP clients.

| Tool Name                | Provider | Description                                                                                                                                                             |
| ------------------------ | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tavily_search`          | Tavily   | Search the web for current information on any topic. Use for news, facts, or data beyond your knowledge cutoff. Returns snippets and source URLs.                           |
| `tavily_extract`         | Tavily   | Extract content from URLs. Returns raw page content in markdown or text format.                                                                                         |
| `tavily_crawl`           | Tavily   | Crawl a website starting from a URL. Extracts content from pages with configurable depth and breadth.                                                                   |
| `tavily_map`             | Tavily   | Map a website's structure. Returns a list of URLs found starting from the base URL.                                                                                     |
| `tavily_research`        | Tavily   | Perform comprehensive research on a given topic or question. Returns a detailed response based on research findings.                                                    |
| `brave_web_search`       | Brave    | Performs a web search using the Brave Search API. Use for general web searches for information, facts, and current topics. Returns a JSON array of results.               |
| `brave_local_search`     | Brave    | Search for local businesses and places using the Brave Search API. Commonly falls back to web search if local results are unavailable. Returns a JSON array of results. |

## Configuration

Configuration is managed via environment variables. Copy `.env.example` to `.env` to start.

### Core Configuration

| Variable              | Description                                                                                               | Default                            |
| --------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| `DATABASE_URL`        | Connection string for the database. For local setups, a file-based SQLite DB is recommended.                | `file:./tavily_bridge.db`          |
| `KEY_ENCRYPTION_SECRET` | A 32-byte (256-bit) secret key used for encrypting and decrypting upstream API keys stored in the database. | (generated in example)             |
| `ADMIN_API_TOKEN`     | Bearer token for accessing the Admin API.                                                                 | (generated in example)             |
| `HOST`                | The host address for the server to listen on.                                                             | `0.0.0.0`                          |
| `PORT`                | The port for the server to listen on.                                                                     | `8787`                             |
| `ENABLE_QUERY_AUTH`   | If `true`, enables MCP client token authentication for the `/mcp` endpoint.                                 | `false`                            |

### Rate Limiting

| Variable                         | Description                                                                 | Default |
| -------------------------------- | --------------------------------------------------------------------------- | ------- |
| `MCP_RATE_LIMIT_PER_MINUTE`      | Max requests per minute per client token.                                   | `60`    |
| `MCP_GLOBAL_RATE_LIMIT_PER_MINUTE` | Max requests per minute across all clients.                               | `600`   |
| `ADMIN_KEY_REVEAL_RATE_LIMIT_PER_MINUTE` | Max key reveal attempts per minute in the Admin UI.                   | `20`    |
| `MCP_MAX_RETRIES`                | Maximum number of retries for failed upstream requests.                     | `2`     |
| `MCP_COOLDOWN_MS`                | Cooldown period in milliseconds for an upstream API key after a failure.    | `60000` |

### Search & Key Strategy

These settings can also be configured live in the **Admin UI → Settings** page.

| Variable                      | Description                                                                                                                                                                                           | Default                          |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| `SEARCH_SOURCE_MODE`          | Defines the search behavior: `tavily_only`, `brave_only`, `combined` (parallel query), or `brave_prefer_tavily_fallback` (Brave first, then Tavily on error).                                             | `brave_prefer_tavily_fallback`   |
| `TAVILY_KEY_SELECTION_STRATEGY` | Strategy for picking an upstream Tavily key when multiple are active: `round_robin` (default) or `random`.                                                                                              | `round_robin`                    |

### Tavily Configuration

| Variable                        | Description                                                                                                     | Default     |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------- | ----------- |
| `TAVILY_USAGE_LOG_MODE`         | Log level for Tavily tool usage: `none`, `hash` (query hash only), `preview` (redacted query), or `full` query.     | `preview`   |
| `TAVILY_USAGE_HASH_SECRET`      | Optional secret for creating a keyed HMAC-SHA256 hash of queries instead of a plain SHA256. Recommended for privacy. | `""`        |
| `TAVILY_USAGE_SAMPLE_RATE`      | Optional sampling rate (0.0 to 1.0) for logging usage events. Empty string means log all events.                  | `""`        |
| `TAVILY_USAGE_RETENTION_DAYS`   | Optional retention period for usage logs. If set, old logs will be periodically cleaned up.                       | `""`        |
| `TAVILY_USAGE_CLEANUP_PROBABILITY` | The probability (0.0 to 1.0) that a cleanup of old usage logs is triggered on a new usage event.                | `0.001`     |
| `TAVILY_CREDITS_MIN_REMAINING`  | Credit threshold at which a Tavily key will be automatically put into `cooldown` status.                          | `1`         |
| `TAVILY_CREDITS_COOLDOWN_MS`    | Cooldown duration for a key that has fallen below the minimum credit threshold.                                   | `300000` (5m) |
| `TAVILY_CREDITS_REFRESH_LOCK_MS` | Lock duration to prevent concurrent credit refreshes for the same key.                                            | `15000`     |
| `TAVILY_CREDITS_REFRESH_TIMEOUT_MS` | Timeout for the upstream Tavily credits API request.                                                            | `5000`      |
| `TAVILY_CREDITS_CACHE_TTL_MS`   | Duration to cache Tavily credit information before it's considered stale.                                       | `60000`     |

### Brave Configuration

If no Brave keys are configured, Brave tools will fall back to using Tavily.

| Variable                  | Description                                                                                                       | Default              |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------- |
| `BRAVE_API_KEY`           | A Brave Search API key. If set, this single key will be used. For multi-key support, add keys via the Admin UI.       | `""`                 |
| `BRAVE_MAX_QPS`           | Max requests per second to the Brave API to stay within rate limits.                                              | `1`                  |
| `BRAVE_MIN_INTERVAL_MS`   | Overrides `BRAVE_MAX_QPS` with a fixed minimum interval between requests.                                           | `""`                 |
| `BRAVE_MAX_QUEUE_MS`      | Max time a request can wait in the queue before failing or falling back to Tavily.                                  | `30000`              |
| `BRAVE_OVERFLOW`          | Behavior when the request queue is full: `fallback_to_tavily` (default), `queue` (wait), or `error`.                | `fallback_to_tavily` |
| `BRAVE_HTTP_TIMEOUT_MS`   | Per-request HTTP timeout for the Brave API.                                                                       | `20000`              |

## Connect an MCP client

1.  Open the Admin UI and create a **client token** from the `Tokens` page.
2.  Use that token to authenticate MCP requests by passing it as a bearer token in the `Authorization` header. Note this is different from the **admin token** used to access the Admin API itself.

### HTTP

-   MCP endpoint: `POST /mcp`
-   Auth: `Authorization: Bearer <client_token>`

### stdio

It is recommended to run a lightweight stdio wrapper via `npx` that connects to the HTTP MCP endpoint. This keeps secrets in `env` instead of CLI arguments.

Set `TAVILY_BRIDGE_BASE_URL` to your deployment URL (for local Docker Compose: `http://localhost:8787`).

```json
{
  "mcpServers": {
    "mcp-nexus": {
      "command": "npx",
      "args": ["-y", "@mcp-nexus/stdio-http-bridge"],
      "env": {
        "TAVILY_BRIDGE_BASE_URL": "http://localhost:8787",
        "TAVILY_BRIDGE_MCP_TOKEN": "<client_token>"
      }
    }
  }
}
```

## Deployment

The server is designed to be deployed as a standalone service. The included `docker-compose.yml` and `Dockerfile` provide a production-ready setup for self-hosting.