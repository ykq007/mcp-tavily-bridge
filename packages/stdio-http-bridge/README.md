# @mcp-tavily-bridge/stdio-http-bridge

Thin stdio ↔ Streamable HTTP bridge for `mcp-tavily-bridge`.

This is intended for MCP clients that only support **stdio** (subprocess) servers, but you want to connect them to a remotely hosted `bridge-server` over HTTP.

## Usage

```sh
npx -y @mcp-tavily-bridge/stdio-http-bridge --base-url https://your-bridge-host --token <client_token>
```

Environment-only (recommended; avoids putting the token on the command line):
```sh
export TAVILY_BRIDGE_BASE_URL="https://your-bridge-host"
export TAVILY_BRIDGE_MCP_TOKEN="<client_token>"
npx -y @mcp-tavily-bridge/stdio-http-bridge
```

## Options

- `--base-url <origin>`: Base URL for the bridge-server; this tool appends `/mcp`.
- `--mcp-url <url>`: Full MCP endpoint URL (overrides `--base-url`).
- `--token <client_token>`: Client token used as `Authorization: Bearer <client_token>` (or set `TAVILY_BRIDGE_MCP_TOKEN`).
- `--default-parameters <json>`: Optional JSON passed via the `default_parameters` HTTP header (falls back to `DEFAULT_PARAMETERS` env var).

## Notes

- This tool does **not** require `DATABASE_URL` or `KEY_ENCRYPTION_SECRET` because it does not rotate upstream Tavily keys; it only proxies MCP traffic to your deployed `bridge-server`.
- All logs are written to stderr so stdout remains the MCP wire protocol.
