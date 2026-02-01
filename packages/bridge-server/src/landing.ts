function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function codeBlock(title: string, code: string): string {
  return `
    <div class="codeBlock">
      <div class="codeBlockHeader">
        <div class="codeBlockTitle">${escapeHtml(title)}</div>
        <button class="btn btn--ghost btn--xs" data-copy="${escapeHtml(code)}" type="button">Copy</button>
      </div>
      <pre class="code"><code>${escapeHtml(code)}</code></pre>
    </div>
  `;
}

export function renderLandingPage(opts: { githubUrl: string; adminPath: string; healthPath: string }): string {
  const { githubUrl, adminPath, healthPath } = opts;

  const connectHttp = `curl -X POST ${healthPath.replace('/health', '/mcp')} \\\n+  -H "Authorization: Bearer <client_token>" \\\n+  -H "Content-Type: application/json" \\\n+  -d '{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/list\",\"params\":{}}'`;

  const connectStdio = `{\n+  \"mcpServers\": {\n+    \"tavily-bridge\": {\n+      \"command\": \"npx\",\n+      \"args\": [\"-y\", \"@mcp-tavily-bridge/stdio-http-bridge\"],\n+      \"env\": {\n+        \"TAVILY_BRIDGE_BASE_URL\": \"http://localhost:8787\",\n+        \"TAVILY_BRIDGE_MCP_TOKEN\": \"<client_token>\"\n+      }\n+    }\n+  }\n+}`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="dark light" />
    <title>mcp-tavily-bridge</title>
    <meta
      name="description"
      content="MCP server that proxies Tavily tools while rotating across a pool of upstream Tavily API keys, with an admin UI for keys, tokens, usage, and credits."
    />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600&family=Fira+Sans:wght@400;500;600;700&display=swap"
      rel="stylesheet"
    />
    <style>
      :root {
        color-scheme: light dark;
        --bg: #f8fafc;
        --surface: #ffffff;
        --surface2: #f1f5f9;
        --text: #0f172a;
        --muted: #475569;
        --border: rgba(15, 23, 42, 0.12);
        --shadow: 0 16px 44px rgba(15, 23, 42, 0.12);
        --primary: #2563eb;
        --primary2: #3b82f6;
        --cta: #10b981;
        --danger: #ef4444;
        --codeBg: #0b1220;
        --codeText: #e2e8f0;
        --mono: "Fira Code", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
        --sans: "Fira Sans", ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji",
          "Segoe UI Emoji";
        --radius: 16px;
      }
      @media (prefers-color-scheme: dark) {
        :root {
          --bg: #0b1220;
          --surface: rgba(15, 23, 42, 0.74);
          --surface2: rgba(15, 23, 42, 0.55);
          --text: #f8fafc;
          --muted: rgba(248, 250, 252, 0.72);
          --border: rgba(248, 250, 252, 0.12);
          --shadow: 0 18px 60px rgba(0, 0, 0, 0.35);
          --primary: #60a5fa;
          --primary2: #93c5fd;
          --cta: #22c55e;
          --danger: #f87171;
          --codeBg: #0a0e1a;
          --codeText: #e5e7eb;
        }
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: var(--sans);
        background: radial-gradient(1200px 600px at 10% -10%, rgba(37, 99, 235, 0.18), transparent 60%),
          radial-gradient(900px 500px at 92% 6%, rgba(16, 185, 129, 0.14), transparent 60%),
          radial-gradient(1000px 500px at 50% 100%, rgba(59, 130, 246, 0.10), transparent 65%),
          var(--bg);
        color: var(--text);
        line-height: 1.45;
      }
      a { color: inherit; text-decoration: none; }
      a:hover { text-decoration: underline; }
      .container { max-width: 1100px; margin: 0 auto; padding: 0 20px; }
      .nav {
        position: sticky;
        top: 0;
        z-index: 10;
        border-bottom: 1px solid var(--border);
        backdrop-filter: blur(16px);
        background: color-mix(in srgb, var(--bg) 70%, transparent 30%);
      }
      .navInner { display: flex; align-items: center; justify-content: space-between; height: 72px; }
      .brand { display: flex; align-items: center; gap: 12px; font-weight: 700; letter-spacing: -0.02em; }
      .logo {
        width: 36px; height: 36px; border-radius: 12px;
        background: linear-gradient(135deg, var(--primary), var(--cta));
        box-shadow: 0 10px 30px rgba(37, 99, 235, 0.20);
      }
      .navLinks { display: flex; align-items: center; gap: 14px; }
      .btn {
        display: inline-flex; align-items: center; justify-content: center; gap: 10px;
        border: 1px solid var(--border);
        background: color-mix(in srgb, var(--surface) 75%, transparent 25%);
        padding: 10px 14px;
        border-radius: 12px;
        font-weight: 600;
        cursor: pointer;
        transition: transform 140ms ease, background 140ms ease, border-color 140ms ease;
      }
      .btn:hover { transform: translateY(-1px); border-color: color-mix(in srgb, var(--primary) 25%, var(--border)); }
      .btn:active { transform: translateY(0); }
      .btn--primary { border-color: color-mix(in srgb, var(--cta) 35%, var(--border)); background: color-mix(in srgb, var(--cta) 20%, var(--surface) 80%); }
      .btn--ghost { background: transparent; }
      .btn--xs { padding: 6px 10px; font-size: 12px; border-radius: 10px; }
      .hero { padding: 56px 0 24px; }
      .heroGrid { display: grid; grid-template-columns: 1.2fr 1fr; gap: 22px; align-items: start; }
      @media (max-width: 900px) { .heroGrid { grid-template-columns: 1fr; } }
      .card {
        border: 1px solid var(--border);
        background: color-mix(in srgb, var(--surface) 82%, transparent 18%);
        border-radius: var(--radius);
        box-shadow: var(--shadow);
        overflow: hidden;
      }
      .cardInner { padding: 22px; }
      .badge {
        display: inline-flex; align-items: center; gap: 8px;
        font-size: 12px; font-weight: 700; letter-spacing: 0.06em;
        text-transform: uppercase;
        padding: 6px 10px; border-radius: 999px;
        background: color-mix(in srgb, var(--primary) 18%, transparent 82%);
        border: 1px solid color-mix(in srgb, var(--primary) 25%, var(--border));
        color: color-mix(in srgb, var(--primary2) 80%, var(--text));
      }
      h1 { margin: 12px 0 10px; font-size: clamp(36px, 5vw, 52px); line-height: 1.05; letter-spacing: -0.03em; }
      .sub { color: var(--muted); font-size: 16px; max-width: 58ch; }
      .ctaRow { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 16px; }
      .pillRow { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 18px; }
      .pill {
        font-size: 12px; font-weight: 600;
        padding: 6px 10px; border-radius: 999px;
        border: 1px solid var(--border);
        background: color-mix(in srgb, var(--surface2) 80%, transparent 20%);
        color: var(--muted);
      }
      .grid3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
      @media (max-width: 900px) { .grid3 { grid-template-columns: 1fr; } }
      .feature { padding: 18px; border-radius: 14px; border: 1px solid var(--border); background: color-mix(in srgb, var(--surface2) 70%, transparent 30%); }
      .featureTitle { font-weight: 800; letter-spacing: -0.01em; margin-bottom: 4px; }
      .featureText { color: var(--muted); font-size: 14px; }
      .section { padding: 20px 0; }
      .sectionTitle { font-size: 20px; font-weight: 800; letter-spacing: -0.02em; margin: 0 0 12px; }
      .twoCol { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
      @media (max-width: 900px) { .twoCol { grid-template-columns: 1fr; } }
      .codeBlock { border: 1px solid var(--border); border-radius: 14px; overflow: hidden; background: var(--codeBg); }
      .codeBlockHeader { display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,0.10); }
      .codeBlockTitle { font-family: var(--mono); font-size: 12px; color: rgba(226, 232, 240, 0.92); }
      .code { margin: 0; padding: 12px; overflow: auto; color: var(--codeText); font-family: var(--mono); font-size: 12px; line-height: 1.55; }
      .statusRow { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
      .statusPill { display: inline-flex; align-items: center; gap: 8px; font-weight: 700; }
      .dot { width: 10px; height: 10px; border-radius: 999px; background: var(--danger); box-shadow: 0 0 0 4px color-mix(in srgb, var(--danger) 15%, transparent 85%); }
      .dot.ok { background: var(--cta); box-shadow: 0 0 0 4px color-mix(in srgb, var(--cta) 16%, transparent 84%); }
      .footer { padding: 26px 0 34px; color: var(--muted); font-size: 13px; }
      .footerLinks { display: flex; gap: 12px; flex-wrap: wrap; }
      .muted { color: var(--muted); }
      .kbd { font-family: var(--mono); font-size: 12px; padding: 2px 8px; border-radius: 8px; border: 1px solid var(--border); background: color-mix(in srgb, var(--surface2) 70%, transparent 30%); }
      .srOnly { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
      @media (prefers-reduced-motion: reduce) {
        .btn { transition: none; }
      }
    </style>
  </head>
  <body>
    <div class="nav">
      <div class="container">
        <div class="navInner">
          <a class="brand" href="/">
            <div class="logo" aria-hidden="true"></div>
            <div>mcp-tavily-bridge</div>
          </a>
          <div class="navLinks">
            <a class="btn btn--ghost" href="${escapeHtml(githubUrl)}" target="_blank" rel="noreferrer">GitHub</a>
            <a class="btn btn--primary" href="${escapeHtml(adminPath)}">Open Admin UI</a>
          </div>
        </div>
      </div>
    </div>

    <div class="container">
      <div class="hero">
        <div class="heroGrid">
          <div class="card">
            <div class="cardInner">
              <div class="badge">Streamable HTTP MCP • Tavily tool surface</div>
              <h1>Reliable Tavily tools for MCP—keys, tokens, usage, and credits.</h1>
              <div class="sub">
                Proxy the official Tavily tool surface while rotating across a pool of upstream Tavily API keys. Add client tokens, observe usage,
                and keep quotas under control.
              </div>
              <div class="ctaRow">
                <a class="btn btn--primary" href="${escapeHtml(adminPath)}">Open Admin UI</a>
                <a class="btn" href="#connect">Connect your client</a>
              </div>
              <div class="pillRow">
                <div class="pill">Key rotation + cooldown</div>
                <div class="pill">Client tokens</div>
                <div class="pill">Usage visibility</div>
                <div class="pill">Credits preflight</div>
              </div>
            </div>
          </div>

          <div class="card">
            <div class="cardInner">
              <div class="statusRow">
                <div>
                  <div class="sectionTitle" style="margin:0;">Status</div>
                  <div class="muted">Live from <span class="kbd">${escapeHtml(healthPath)}</span></div>
                </div>
                <div class="statusPill">
                  <span id="statusDot" class="dot" aria-hidden="true"></span>
                  <span id="statusText">Checking…</span>
                </div>
              </div>
              <div style="height: 10px"></div>
              <div class="grid3">
                <div class="feature">
                  <div class="featureTitle">Server</div>
                  <div class="featureText"><span id="healthOk" class="kbd">—</span></div>
                </div>
                <div class="feature">
                  <div class="featureTitle">Active keys</div>
                  <div class="featureText"><span id="activeKeys" class="kbd">—</span></div>
                </div>
                <div class="feature">
                  <div class="featureTitle">Endpoint</div>
                  <div class="featureText"><span class="kbd">/mcp</span></div>
                </div>
              </div>
              <div style="height: 14px"></div>
              <div class="muted" style="font-size: 13px;">
                Tip: create a <strong>client token</strong> in the Admin UI (<span class="kbd">Tokens</span>) and use it in MCP requests.
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="sectionTitle">Why this exists</div>
        <div class="grid3">
          <div class="feature">
            <div class="featureTitle">Rotate safely</div>
            <div class="featureText">Automatically rotate across multiple upstream Tavily API keys and cool down keys that hit limits.</div>
          </div>
          <div class="feature">
            <div class="featureTitle">Operate confidently</div>
            <div class="featureText">See what Tavily is being used for (privacy-aware query logging) and spot errors early.</div>
          </div>
          <div class="feature">
            <div class="featureTitle">Control access</div>
            <div class="featureText">Issue client tokens for MCP consumers without distributing your upstream Tavily keys.</div>
          </div>
        </div>
      </div>

      <div class="section" id="connect">
        <div class="sectionTitle">Connect your client</div>
        <div class="twoCol">
          ${codeBlock('stdio (recommended)', connectStdio)}
          ${codeBlock('HTTP (debug)', connectHttp)}
        </div>
        <div style="height: 10px"></div>
        <div class="muted" style="font-size: 13px;">
          The Admin UI lives at <a href="${escapeHtml(adminPath)}"><span class="kbd">${escapeHtml(adminPath)}</span></a>.
        </div>
      </div>

      <div class="footer">
        <div class="statusRow">
          <div>© ${new Date().getFullYear()} mcp-tavily-bridge</div>
          <div class="footerLinks">
            <a href="${escapeHtml(adminPath)}">Admin UI</a>
            <a href="${escapeHtml(githubUrl)}" target="_blank" rel="noreferrer">GitHub</a>
            <a href="${escapeHtml(healthPath)}">Health</a>
          </div>
        </div>
      </div>
    </div>

    <script>
      (function () {
        const statusDot = document.getElementById('statusDot');
        const statusText = document.getElementById('statusText');
        const healthOk = document.getElementById('healthOk');
        const activeKeys = document.getElementById('activeKeys');
        const copyButtons = document.querySelectorAll('[data-copy]');

        function setStatus(ok, active) {
          if (ok) {
            statusDot.classList.add('ok');
            statusText.textContent = 'Online';
          } else {
            statusDot.classList.remove('ok');
            statusText.textContent = 'Unavailable';
          }
          healthOk.textContent = String(Boolean(ok));
          activeKeys.textContent = typeof active === 'number' ? String(active) : '—';
        }

        async function loadHealth() {
          try {
            const res = await fetch('${escapeHtml(healthPath)}', { headers: { 'cache-control': 'no-store' } });
            const json = await res.json();
            setStatus(Boolean(json && json.ok), typeof json?.activeKeys === 'number' ? json.activeKeys : undefined);
          } catch (e) {
            setStatus(false);
          }
        }

        copyButtons.forEach((btn) => {
          btn.addEventListener('click', async () => {
            const text = btn.getAttribute('data-copy') || '';
            try {
              await navigator.clipboard.writeText(text);
              btn.textContent = 'Copied';
              setTimeout(() => (btn.textContent = 'Copy'), 900);
            } catch (e) {
              btn.textContent = 'Copy failed';
              setTimeout(() => (btn.textContent = 'Copy'), 900);
            }
          });
        });

        loadHealth();
        setInterval(loadHealth, 10000);
      })();
    </script>
  </body>
</html>`;
}

