# mcp-nexus

[English](README.md) | 中文

`mcp-nexus` 是一个强大的、支持多提供商的模型上下文协议（MCP）服务器，充当 **Tavily** 和 **Brave Search** API 的桥梁。它提供统一的工具接口，可轮换使用上游 API 密钥池，并通过一个全面的管理后台进行管理。

## 功能特性

-   **统一的搜索 API**: 通过单一 MCP 端点，同时提供 Tavily 和 Brave Search 的工具。
-   **API 密钥管理**: 轻松添加、管理和轮换多个 Tavily 和 Brave API 密钥，以分散负载和应对速率限制。
-   **客户端认证**: 使用 Bearer Token 保护 MCP 端点，这些 Token 可通过管理后台创建和撤销。
-   **Web 管理后台**: 一个用户友好的界面，用于管理 API 密钥、客户端 Token、查看使用统计数据和配置服务器设置。
-   **使用情况监控**: 跟踪工具使用情况，检查查询历史，并获取最常用工具和查询的摘要。
-   **灵活的搜索策略**: 无需重启服务器，即可动态配置搜索源（`tavily_only`、`brave_only`、`combined` 等）和密钥选择策略（`round_robin`、`random`）。
-   **速率限制**: 内置对 MCP 客户端和上游 API 调用的速率限制，以防止滥用和管理成本。
-   **灵活部署**: 可使用 Node.js 在本地运行，或使用提供的 Docker Compose 配置在任何地方部署。

## 快速开始（本地）

### Docker Compose（推荐）

```bash
cp .env.example .env
# 编辑 .env 文件，设置你的 ADMIN_API_TOKEN 和其他配置
docker compose up --build
```

SQLite 数据存储在挂载到 `/data` 的 Docker 卷中。

然后打开：
-   管理后台：`http://localhost:8787/admin`
-   MCP 端点：`http://localhost:8787/mcp`

### 本地 Node.js

需要设置 `.env.example` 中的环境变量。

```bash
npm install
npx prisma migrate deploy --schema packages/db/prisma/schema.prisma
npm run dev:bridge-server
```

## Workspace

-   `packages/core`: 包含 Tavily/Brave 客户端、密钥管理和 MCP 工具模式的核心逻辑。
-   `packages/bridge-server`: 主 HTTP 服务器，提供 MCP 端点和管理 API/UI。
-   `packages/bridge-stdio`: 用于本地客户端集成的轻量级 stdio 服务器。
-   `packages/stdio-http-bridge`: 用于将 stdio 客户端连接到 HTTP 服务器的辅助包。
-   `packages/db`: 用于所有数据持久化的 Prisma schema 和数据库客户端。
-   `packages/admin-ui`: 基于 React 的管理后台前端。

## 管理后台

管理后台提供了一个集中管理 `mcp-nexus` 实例的地方。

-   **密钥 (Keys)**: 管理你的上游 **Tavily** 和 **Brave** API 密钥池。你可以添加、删除、更新状态（active, disabled），并监控 Tavily 密钥的剩余额度。
-   **令牌 (Tokens)**: 创建和撤销用于向 MCP 端点进行身份验证的客户端令牌。
-   **用量 (Usage)**: 查看详细的工具使用统计和查询历史，可按日期范围、工具和客户端进行筛选。
-   **设置 (Settings)**: 配置实时的服务器设置，例如上游密钥选择策略和搜索源模式。

## MCP 工具

服务器向 MCP 客户端提供以下工具。

| 工具名称             | 提供商 | 描述                                                                                                                                                    |
| -------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tavily_search`      | Tavily | 搜索网络以获取有关任何主题的最新信息。用于新闻、事实或超出您知识截止范围的数据。返回摘要和源 URL。                                                        |
| `tavily_extract`     | Tavily | 从 URL 提取内容。以 markdown 或文本格式返回原始页面内容。                                                                                               |
| `tavily_crawl`       | Tavily | 从一个 URL 开始爬取网站。从页面中提取内容，深度和广度可配置。                                                                                           |
| `tavily_map`         | Tavily | 映射网站结构。返回从基础 URL 开始找到的 URL 列表。                                                                                                      |
| `tavily_research`    | Tavily | 对给定主题或问题进行全面研究。返回基于研究结果的详细响应。                                                                                              |
| `brave_web_search`   | Brave  | 使用 Brave Search API 执行网页搜索。用于一般信息、事实和当前主题的网页搜索。返回一个 JSON 数组的结果。                                                    |
| `brave_local_search` | Brave  | 使用 Brave Search API 搜索本地商家和地点。如果本地结果不可用，通常会回退到网页搜索。返回一个 JSON 数组的结果。                                            |

## 配置

配置通过环境变量进行管理。将 `.env.example` 复制为 `.env` 开始使用。

### 核心配置

| 变量                  | 描述                                                                                             | 默认值                             |
| --------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------- |
| `DATABASE_URL`        | 数据库的连接字符串。对于本地设置，推荐使用基于文件的 SQLite 数据库。                             | `file:./tavily_bridge.db`          |
| `KEY_ENCRYPTION_SECRET` | 一个 32 字节（256 位）的密钥，用于加密和解密存储在数据库中的上游 API 密钥。                      | (在示例中生成)                     |
| `ADMIN_API_TOKEN`     | 用于访问管理 API 的 Bearer Token。                                                               | (在示例中生成)                     |
| `HOST`                | 服务器监听的主机地址。                                                                           | `0.0.0.0`                          |
| `PORT`                | 服务器监听的端口。                                                                               | `8787`                             |
| `ENABLE_QUERY_AUTH`   | 如果为 `true`，则为 `/mcp` 端点启用 MCP 客户端令牌认证。                                         | `false`                            |

### 速率限制

| 变量                                   | 描述                                                              | 默认值  |
| -------------------------------------- | ----------------------------------------------------------------- | ------- |
| `MCP_RATE_LIMIT_PER_MINUTE`            | 每个客户端令牌每分钟的最大请求数。                                | `60`    |
| `MCP_GLOBAL_RATE_LIMIT_PER_MINUTE`       | 所有客户端每分钟的总最大请求数。                                  | `600`   |
| `ADMIN_KEY_REVEAL_RATE_LIMIT_PER_MINUTE` | 在管理后台中每分钟最大密钥显示尝试次数。                          | `20`    |
| `MCP_MAX_RETRIES`                      | 失败的上游请求的最大重试次数。                                    | `2`     |
| `MCP_COOLDOWN_MS`                      | 上游 API 密钥失败后的冷却时间（毫秒）。                           | `60000` |

### 搜索与密钥策略

这些设置也可以在 **管理后台 → 设置** 页面实时配置。

| 变量                          | 描述                                                                                                                                                     | 默认值                           |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| `SEARCH_SOURCE_MODE`          | 定义搜索行为：`tavily_only`（仅 Tavily），`brave_only`（仅 Brave），`combined`（并行查询），或 `brave_prefer_tavily_fallback`（Brave 优先，出错时回退到 Tavily）。 | `brave_prefer_tavily_fallback`   |
| `TAVILY_KEY_SELECTION_STRATEGY` | 当有多个活动的 Tavily 密钥时，选择上游密钥的策略：`round_robin`（轮询，默认）或 `random`（随机）。                                                        | `round_robin`                    |

### Tavily 配置

| 变量                             | 描述                                                                                                   | 默认值      |
| -------------------------------- | ------------------------------------------------------------------------------------------------------ | ----------- |
| `TAVILY_USAGE_LOG_MODE`          | Tavily 工具使用日志的级别：`none`，`hash`（仅查询哈希），`preview`（脱敏查询），或 `full`（完整查询）。       | `preview`   |
| `TAVILY_USAGE_HASH_SECRET`       | 用于为查询创建 HMAC-SHA256 哈希（而不是普通 SHA256）的可选密钥。为保护隐私推荐使用。                      | `""`        |
| `TAVILY_USAGE_SAMPLE_RATE`       | 记录使用事件的可选采样率（0.0 到 1.0）。空字符串表示记录所有事件。                                     | `""`        |
| `TAVILY_USAGE_RETENTION_DAYS`    | 使用日志的可选保留期限。如果设置，旧日志将被定期清理。                                                 | `""`        |
| `TAVILY_USAGE_CLEANUP_PROBABILITY` | 在新使用事件上触发旧使用日志清理的概率（0.0 到 1.0）。                                               | `0.001`     |
| `TAVILY_CREDITS_MIN_REMAINING`   | Tavily 密钥将自动进入 `cooldown` 状态的额度阈值。                                                      | `1`         |
| `TAVILY_CREDITS_COOLDOWN_MS`     | 低于最小额度阈值的密钥的冷却持续时间。                                                                 | `300000` (5分钟) |
| `TAVILY_CREDITS_REFRESH_LOCK_MS` | 锁定持续时间，以防止对同一密钥的并发额度刷新。                                                         | `15000`     |
| `TAVILY_CREDITS_REFRESH_TIMEOUT_MS` | 上游 Tavily 额度 API 请求的超时时间。                                                                | `5000`      |
| `TAVILY_CREDITS_CACHE_TTL_MS`    | Tavily 额度信息在被视为过时之前缓存的持续时间。                                                        | `60000`     |

### Brave 配置

如果未配置 Brave 密钥，Brave 工具将回退到使用 Tavily。

| 变量                    | 描述                                                                                               | 默认值                 |
| ----------------------- | -------------------------------------------------------------------------------------------------- | -------------------- |
| `BRAVE_API_KEY`         | Brave Search API 密钥。如果设置，将使用此单个密钥。要支持多密钥，请通过管理后台添加。               | `""`                 |
| `BRAVE_MAX_QPS`         | 对 Brave API 每秒最大请求数，以保持在速率限制内。                                                  | `1`                  |
| `BRAVE_MIN_INTERVAL_MS` | 使用固定的最小请求间隔覆盖 `BRAVE_MAX_QPS`。                                                       | `""`                 |
| `BRAVE_MAX_QUEUE_MS`    | 请求在队列中等待失败或回退到 Tavily 之前的最长时间。                                               | `30000`              |
| `BRAVE_OVERFLOW`        | 请求队列满时的行为：`fallback_to_tavily`（默认），`queue`（等待），或 `error`（报错）。            | `fallback_to_tavily` |
| `BRAVE_HTTP_TIMEOUT_MS` | 对 Brave API 的单次请求 HTTP 超时。                                                                | `20000`              |

## 连接 MCP 客户端

1.  打开管理后台，从 `令牌 (Tokens)` 页面创建一个 **客户端令牌 (client token)**。
2.  通过在 `Authorization` header 中作为 bearer token 传递该令牌来认证 MCP 请求。请注意，这与用于访问管理 API 本身的 **管理令牌 (admin token)** 不同。

### HTTP

-   MCP 端点：`POST /mcp`
-   认证：`Authorization: Bearer <client_token>`

### stdio

建议通过 `npx` 运行一个轻量级的 stdio 包装器，它会连接到 HTTP MCP 端点。这样可以将密钥保留在 `env` 中，而不是作为命令行参数。

将 `TAVILY_BRIDGE_BASE_URL` 设置为你的部署 URL（对于本地 Docker Compose：`http://localhost:8787`）。

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

## 部署

该服务器设计为可作为独立服务部署。附带的 `docker-compose.yml` 和 `Dockerfile` 为自托管提供了一个生产就绪的设置。
