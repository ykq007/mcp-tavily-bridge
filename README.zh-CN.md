# mcp-tavily-bridge

[English](README.md) | 中文

这是一个 MCP 服务器：代理官方 `tavily-mcp` 工具面，并通过一个 Admin UI 管理/轮换多把上游 Tavily API Key。

## 快速开始（本地）

### Docker Compose（推荐）

```bash
cp .env.example .env
docker compose up --build
```

SQLite 数据存储在挂载到容器 `/data` 的卷中。

然后访问：
- Admin UI：`http://localhost:8787/admin`
- MCP endpoint：`http://localhost:8787/mcp`

## Workspace

- `packages/core`: 共享 schemas/格式化 + Tavily client + key rotation
- `packages/bridge-server`: Streamable HTTP MCP server + Admin API（并提供 Admin UI 静态资源）
- `packages/bridge-stdio`: stdio MCP server（同一套 tools）
- `packages/db`: Prisma schema + DB client
- `packages/admin-ui`: Admin UI

## 部署方式

- 本地/自托管（Docker Compose）：参见 `docker-compose.yml`。

### 本地快速开始（Node）

需要 `.env.example` 中的 env vars（至少：`DATABASE_URL`、`ADMIN_API_TOKEN`、`KEY_ENCRYPTION_SECRET`）。`DATABASE_URL` 使用 SQLite file URL（例如 `file:./tavily_bridge.db`）。

```bash
npm install
npx prisma migrate deploy --schema packages/db/prisma/schema.prisma
npm run dev:bridge-server
```

## 连接 MCP 客户端

1. 打开 Admin UI，创建一个 **client token**（`Tokens` 页面）。
2. 使用该 client token 对 MCP 请求进行鉴权（注意：这与访问 Admin UI 使用的 **admin token** 不同）。

### HTTP

- MCP endpoint：`POST /mcp`
- 鉴权：`Authorization: Bearer <client_token>`

### stdio

推荐：通过 `npx` 运行一个轻量 stdio wrapper，它会连接到 HTTP MCP endpoint（把 secret 放在 `env`，不要放在 args 里）：

将 `TAVILY_BRIDGE_BASE_URL` 设置为你的部署地址（本地 Docker Compose：`http://localhost:8787`）。

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

## Tavily 用量日志（Usage Logging）

本项目可以记录 Tavily 的使用情况（按工具的使用事件），并在 Admin UI 的 **Usage** 页面展示。

默认隐私策略：保存 query hash + 经过脱敏的 query 预览（不保存完整明文）。可通过以下 env vars 配置：

- `TAVILY_USAGE_LOG_MODE`: `none|hash|preview|full`（默认：`preview`）
- `TAVILY_USAGE_HASH_SECRET`: 可选；设置后 `queryHash` 使用 `HMAC-SHA256`（推荐）
- `TAVILY_USAGE_SAMPLE_RATE`: 可选 `0..1` 采样率
- `TAVILY_USAGE_RETENTION_DAYS`: 可选；保留天数（启用清理）
- `TAVILY_USAGE_CLEANUP_PROBABILITY`: 可选；每次记录触发清理的概率（默认：`0.001`）

## 上游 Key 选择策略

当存在多把上游 Tavily API Key 时，bridge 会按“每次请求”选择使用哪一把 key：

- `TAVILY_KEY_SELECTION_STRATEGY`: `round_robin`（默认）或 `random`

也可以在 Admin UI（**Settings → Server**）中进行覆盖配置：配置会持久化在服务端并立即生效。
