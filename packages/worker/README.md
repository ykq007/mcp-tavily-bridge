# MCP Nexus - Cloudflare Workers

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/ykq007/mcp-nexus/tree/main/packages/worker)

One-click deployment of MCP Nexus to Cloudflare's free tier. This provides a unified MCP server for Tavily and Brave Search APIs with automatic API key rotation.

## Features

- **Zero-cost hosting** on Cloudflare Workers free tier
- **D1 Database** for persistent storage (automatic provisioning)
- **Encrypted API keys** with Web Crypto API
- **Admin UI included** - Full web interface for managing keys and tokens
- **7 MCP tools**: tavily_search, tavily_extract, tavily_crawl, tavily_map, tavily_research, brave_web_search, brave_local_search

## Deploy

### Option 1: One-Click Deploy

Click the button above and follow the prompts. You'll be asked to:

1. Authorize Cloudflare to access your GitHub (fork will be created)
2. Configure secrets:
   - `ADMIN_API_TOKEN`: Token for admin API access (generate with `openssl rand -hex 32`)
   - `KEY_ENCRYPTION_SECRET`: Key for encrypting API keys (generate with `openssl rand -base64 32`)

### Option 2: Manual Deploy

```bash
# Clone the repo
git clone https://github.com/ykq007/mcp-nexus.git
cd mcp-nexus/packages/worker

# Install dependencies
npm install

# Create D1 database
npx wrangler d1 create mcp-nexus-db
# Copy the database_id from output to wrangler.jsonc

# Set secrets
npx wrangler secret put ADMIN_API_TOKEN
npx wrangler secret put KEY_ENCRYPTION_SECRET

# Run migrations and deploy
npm run deploy
```

## Post-Deployment Setup

After deployment, you need to add API keys and create client tokens.

### 1. Add Tavily API Keys

```bash
curl -X POST https://your-worker.workers.dev/admin/api/tavily-keys \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"label": "Primary Key", "key": "tvly-xxxxx"}'
```

### 2. Add Brave API Keys (Optional)

```bash
curl -X POST https://your-worker.workers.dev/admin/api/brave-keys \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"label": "Primary Key", "key": "BSAxxxxx"}'
```

### 3. Create Client Token

```bash
curl -X POST https://your-worker.workers.dev/admin/api/tokens \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"description": "Claude Desktop"}'
```

Save the returned `token` - it's only shown once.

## MCP Client Configuration

### Claude Desktop / Cline

```json
{
  "mcpServers": {
    "mcp-nexus": {
      "command": "npx",
      "args": ["-y", "@anthropic-ai/mcp-proxy", "https://your-worker.workers.dev/mcp"],
      "env": {
        "MCP_HEADERS": "Authorization: Bearer YOUR_CLIENT_TOKEN"
      }
    }
  }
}
```

### Direct HTTP

```bash
curl -X POST https://your-worker.workers.dev/mcp \
  -H "Authorization: Bearer YOUR_CLIENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/list",
    "id": 1
  }'
```

## API Endpoints

| Endpoint | Auth | Description |
|----------|------|-------------|
| `POST /mcp` | Client Token | MCP JSON-RPC endpoint |
| `GET /health` | None | Health check |
| `GET /admin/api/tavily-keys` | Admin Token | List Tavily keys |
| `POST /admin/api/tavily-keys` | Admin Token | Add Tavily key |
| `DELETE /admin/api/tavily-keys/:id` | Admin Token | Delete Tavily key |
| `GET /admin/api/brave-keys` | Admin Token | List Brave keys |
| `POST /admin/api/brave-keys` | Admin Token | Add Brave key |
| `DELETE /admin/api/brave-keys/:id` | Admin Token | Delete Brave key |
| `GET /admin/api/tokens` | Admin Token | List client tokens |
| `POST /admin/api/tokens` | Admin Token | Create client token |
| `DELETE /admin/api/tokens/:id` | Admin Token | Revoke client token |
| `GET /admin/api/settings` | Admin Token | Get settings |
| `PUT /admin/api/settings` | Admin Token | Update settings |
| `GET /admin/api/usage` | Admin Token | View usage logs |

## Local Development

```bash
# Install dependencies
npm install

# Create local D1 database
npm run db:migrate:local

# Start dev server
npm run dev
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Cloudflare Workers                      │
├─────────────────────────────────────────────────────────┤
│  Hono Router                                            │
│  ├── /mcp (MCP JSON-RPC)                               │
│  ├── /admin/api/* (Admin API)                          │
│  └── /health                                           │
├─────────────────────────────────────────────────────────┤
│  Services                                               │
│  ├── Key Pool (rotation, cooldown)                     │
│  ├── Tavily Client                                     │
│  └── Brave Client                                      │
├─────────────────────────────────────────────────────────┤
│  D1 Database                                           │
│  ├── tavily_keys (encrypted)                           │
│  ├── brave_keys (encrypted)                            │
│  ├── client_tokens (hashed)                            │
│  ├── server_settings                                   │
│  └── usage_logs                                        │
└─────────────────────────────────────────────────────────┘
```

## License

MIT
