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

  const connectHttp = `curl -X POST ${healthPath.replace('/health', '/mcp')} \\\n  -H "Authorization: Bearer <client_token>" \\\n  -H "Content-Type: application/json" \\\n  -d '{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/list\",\"params\":{}}'`;

  const connectStdio = `export TAVILY_BRIDGE_BASE_URL="http://localhost:8787"
export TAVILY_BRIDGE_MCP_TOKEN="<client_token>"

npx -y @nexus-mcp/stdio-http-bridge`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="dark light" />
    <title>MCP Nexus • mcp-nexus Tavily Bridge</title>
    <meta
      name="description"
      content="mcp-nexus: production-ready Tavily MCP bridge with key rotation, client tokens, and admin observability."
    />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600&family=Inter:wght@400;500;600;700;800&display=swap"
      rel="stylesheet"
    />
    <style>
      :root {
        color-scheme: light dark;
        --bg: #f7f9fc;
        --surface: #ffffff;
        --surfaceSoft: #f1f5f9;
        --text: #0f172a;
        --muted: #475569;
        --border: rgba(15, 23, 42, 0.12);
        --ring: rgba(37, 99, 235, 0.22);
        --shadow: 0 14px 40px rgba(15, 23, 42, 0.12);
        --primary: #2563eb;
        --accent: #0ea5e9;
        --success: #10b981;
        --danger: #ef4444;
        --codeBg: #0b1220;
        --codeText: #e2e8f0;
        --sans: "Inter", ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji";
        --mono: "Fira Code", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      }

      @media (prefers-color-scheme: dark) {
        :root {
          --bg: #070b14;
          --surface: rgba(15, 23, 42, 0.78);
          --surfaceSoft: rgba(15, 23, 42, 0.64);
          --text: #f8fafc;
          --muted: rgba(241, 245, 249, 0.72);
          --border: rgba(248, 250, 252, 0.13);
          --ring: rgba(96, 165, 250, 0.28);
          --shadow: 0 20px 62px rgba(2, 6, 23, 0.6);
          --primary: #60a5fa;
          --accent: #38bdf8;
          --success: #22c55e;
          --danger: #f87171;
          --codeBg: #080d18;
          --codeText: #dbeafe;
        }
      }

      * { box-sizing: border-box; }

      body {
        margin: 0;
        font-family: var(--sans);
        background:
          radial-gradient(1200px 640px at -10% -10%, rgba(37, 99, 235, 0.2), transparent 60%),
          radial-gradient(900px 540px at 108% 0%, rgba(14, 165, 233, 0.14), transparent 64%),
          radial-gradient(900px 500px at 50% 110%, rgba(16, 185, 129, 0.12), transparent 65%),
          var(--bg);
        color: var(--text);
        line-height: 1.5;
      }

      a { color: inherit; text-decoration: none; }
      a:hover { text-decoration: underline; }

      .container { max-width: 1140px; margin: 0 auto; padding: 0 20px; }

      .topbar {
        position: sticky;
        top: 0;
        z-index: 10;
        border-bottom: 1px solid var(--border);
        background: color-mix(in srgb, var(--bg) 74%, transparent 26%);
        backdrop-filter: blur(16px);
      }

      .topbarInner {
        height: 72px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
      }

      .brand {
        display: inline-flex;
        align-items: center;
        gap: 12px;
      }

      .brandMark {
        width: 36px;
        height: 36px;
        border-radius: 11px;
        background: linear-gradient(135deg, var(--primary), var(--accent));
        box-shadow: 0 10px 30px rgba(37, 99, 235, 0.25);
      }

      .brandText {
        font-weight: 800;
        letter-spacing: -0.02em;
      }

      .brandSub {
        font-size: 12px;
        color: var(--muted);
      }

      .navActions { display: flex; align-items: center; gap: 12px; }

      .btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        border: 1px solid var(--border);
        background: color-mix(in srgb, var(--surface) 84%, transparent 16%);
        color: var(--text);
        border-radius: 12px;
        padding: 10px 14px;
        font-weight: 600;
        cursor: pointer;
        transition: transform 140ms ease, border-color 140ms ease, box-shadow 140ms ease, background 140ms ease;
      }

      .btn:hover {
        transform: translateY(-1px);
        border-color: color-mix(in srgb, var(--primary) 30%, var(--border));
        box-shadow: 0 0 0 3px var(--ring);
        text-decoration: none;
      }

      .btn:active { transform: translateY(0); }
      .btn--ghost { background: transparent; }
      .btn--primary {
        border-color: color-mix(in srgb, var(--primary) 35%, var(--border));
        background: color-mix(in srgb, var(--primary) 18%, var(--surface) 82%);
      }

      .btn--xs { padding: 6px 10px; font-size: 12px; border-radius: 10px; }

      .hero {
        padding: 56px 0 20px;
        display: grid;
        grid-template-columns: 1.2fr 0.85fr;
        gap: 18px;
      }

      @media (max-width: 960px) {
        .hero { grid-template-columns: 1fr; }
      }

      .card {
        border: 1px solid var(--border);
        border-radius: 18px;
        background: color-mix(in srgb, var(--surface) 86%, transparent 14%);
        box-shadow: var(--shadow);
        overflow: hidden;
      }

      .cardInner { padding: 24px; }

      .eyebrow {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: color-mix(in srgb, var(--primary) 75%, var(--text));
      }

      h1 {
        margin: 10px 0 10px;
        font-size: clamp(34px, 5vw, 52px);
        line-height: 1.05;
        letter-spacing: -0.03em;
      }

      .lead {
        margin: 0;
        color: var(--muted);
        max-width: 60ch;
      }

      .ctaRow {
        margin-top: 18px;
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }

      .pillRow {
        margin-top: 18px;
        display: flex;
        flex-wrap: wrap;
        gap: 9px;
      }

      .pill {
        border: 1px solid var(--border);
        border-radius: 999px;
        padding: 6px 10px;
        font-size: 12px;
        font-weight: 600;
        color: var(--muted);
        background: color-mix(in srgb, var(--surfaceSoft) 82%, transparent 18%);
      }

      .section { padding: 18px 0; }

      .sectionTitle {
        margin: 0 0 12px;
        font-size: 21px;
        font-weight: 800;
        letter-spacing: -0.02em;
      }

      .grid3 {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 12px;
      }

      .twoCol {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
      }

      @media (max-width: 960px) {
        .grid3, .twoCol { grid-template-columns: 1fr; }
      }

      .feature {
        border: 1px solid var(--border);
        border-radius: 14px;
        padding: 16px;
        background: color-mix(in srgb, var(--surfaceSoft) 72%, transparent 28%);
      }

      .featureTitle {
        margin-bottom: 4px;
        font-weight: 700;
      }

      .featureText {
        color: var(--muted);
        font-size: 14px;
      }

      .statusRow {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        flex-wrap: wrap;
      }

      .statusPill {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-weight: 700;
      }

      .dot {
        width: 10px;
        height: 10px;
        border-radius: 999px;
        background: var(--danger);
        box-shadow: 0 0 0 4px color-mix(in srgb, var(--danger) 14%, transparent 86%);
      }

      .dot.ok {
        background: var(--success);
        box-shadow: 0 0 0 4px color-mix(in srgb, var(--success) 16%, transparent 84%);
      }

      .codeBlock {
        border: 1px solid var(--border);
        border-radius: 14px;
        overflow: hidden;
        background: var(--codeBg);
      }

      .codeBlockHeader {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: 10px 12px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.12);
      }

      .codeBlockTitle {
        font-family: var(--mono);
        color: rgba(226, 232, 240, 0.9);
        font-size: 12px;
      }

      .code {
        margin: 0;
        padding: 12px;
        overflow: auto;
        color: var(--codeText);
        font-family: var(--mono);
        font-size: 12px;
        line-height: 1.55;
      }

      .kbd {
        display: inline-flex;
        align-items: center;
        font-family: var(--mono);
        font-size: 12px;
        border: 1px solid var(--border);
        border-radius: 8px;
        padding: 2px 8px;
        background: color-mix(in srgb, var(--surfaceSoft) 72%, transparent 28%);
      }

      .muted { color: var(--muted); }

      .footer {
        padding: 24px 0 34px;
        color: var(--muted);
        font-size: 13px;
      }

      .footerLinks {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
      }

      @media (prefers-reduced-motion: reduce) {
        .btn { transition: none; }
      }
    </style>
  </head>
  <body>
    <header class="topbar">
      <div class="container">
        <div class="topbarInner">
          <a class="brand" href="/">
            <span class="brandMark" aria-hidden="true"></span>
            <span>
              <div class="brandText">mcp-nexus</div>
              <div class="brandSub">Tavily MCP bridge</div>
            </span>
          </a>
          <div class="navActions">
            <a class="btn btn--ghost" href="${escapeHtml(githubUrl)}" target="_blank" rel="noreferrer">GitHub</a>
            <a class="btn btn--primary" href="${escapeHtml(adminPath)}">Open Admin UI</a>
          </div>
        </div>
      </div>
    </header>

    <main class="container">
      <section class="hero">
        <div class="card">
          <div class="cardInner">
            <div class="eyebrow">Streamable HTTP MCP • Tavily tool surface</div>
            <h1>Run a reliable MCP gateway for Tavily with production-safe controls.</h1>
            <p class="lead">
              mcp-nexus proxies the official Tavily tool interface with key rotation, client token auth, and admin visibility
              so your apps can scale without exposing upstream secrets.
            </p>
            <div class="ctaRow">
              <a class="btn btn--primary" href="${escapeHtml(adminPath)}">Open Admin UI</a>
              <a class="btn" href="#connect">Connect your client</a>
            </div>
            <div class="pillRow">
              <span class="pill">Rotating upstream keys</span>
              <span class="pill">Client token access</span>
              <span class="pill">Usage + credits visibility</span>
              <span class="pill">Single MCP endpoint</span>
            </div>
          </div>
        </div>

        <aside class="card">
          <div class="cardInner">
            <div class="statusRow">
              <div>
                <div class="sectionTitle" style="margin:0;">Gateway status</div>
                <div class="muted">Live from <span class="kbd">${escapeHtml(healthPath)}</span></div>
              </div>
              <div class="statusPill">
                <span id="statusDot" class="dot" aria-hidden="true"></span>
                <span id="statusText">Checking…</span>
              </div>
            </div>

            <div style="height: 12px"></div>

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

            <div style="height: 12px"></div>

            <div class="muted" style="font-size: 13px;">
              Tip: create a <strong>client token</strong> in Admin UI <span class="kbd">Tokens</span>, then use it as a Bearer token.
            </div>
          </div>
        </aside>
      </section>

      <section class="section">
        <div class="sectionTitle">Why teams use mcp-nexus</div>
        <div class="grid3">
          <div class="feature">
            <div class="featureTitle">Protect upstream keys</div>
            <div class="featureText">Keep Tavily keys server-side while clients authenticate with revocable MCP tokens.</div>
          </div>
          <div class="feature">
            <div class="featureTitle">Smooth rate-limit handling</div>
            <div class="featureText">Rotate across key pools and cool down constrained keys to reduce request failures.</div>
          </div>
          <div class="feature">
            <div class="featureTitle">Operate with confidence</div>
            <div class="featureText">Use the admin console for key health, token management, usage logs, and credit checks.</div>
          </div>
        </div>
      </section>

      <section class="section" id="connect">
        <div class="sectionTitle">Connect your client</div>
        <div class="twoCol">
          ${codeBlock('stdio (recommended)', connectStdio)}
          ${codeBlock('HTTP (debug)', connectHttp)}
        </div>
        <div style="height: 10px"></div>
        <div class="muted" style="font-size: 13px;">
          Requires <span class="kbd">TAVILY_BRIDGE_BASE_URL</span> + <span class="kbd">TAVILY_BRIDGE_MCP_TOKEN</span>. Admin UI: <a href="${escapeHtml(adminPath)}"><span class="kbd">${escapeHtml(adminPath)}</span></a>
        </div>
      </section>

      <footer class="footer">
        <div class="statusRow">
          <div>© ${new Date().getFullYear()} mcp-nexus</div>
          <div class="footerLinks">
            <a href="${escapeHtml(adminPath)}">Admin UI</a>
            <a href="${escapeHtml(githubUrl)}" target="_blank" rel="noreferrer">GitHub</a>
            <a href="${escapeHtml(healthPath)}">Health</a>
          </div>
        </div>
      </footer>
    </main>

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
