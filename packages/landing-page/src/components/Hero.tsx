const stats = [
  { value: '2+', label: 'Search providers unified' },
  { value: '24/7', label: 'Health-aware key routing' },
  { value: '1 UI', label: 'Admin control center' }
];

const highlights = [
  'Smart key rotation with cooldown and recovery logic',
  'Client token controls to isolate and manage usage',
  'Operational visibility across requests, credits, and errors'
];

export function Hero() {
  return (
    <section className="hero" aria-labelledby="landing-hero-title">
      <div className="landing-shell hero__container">
        <div className="hero__content">
          <p className="hero__eyebrow">SEARCH INFRASTRUCTURE, REFINED</p>
          <h1 className="hero__title" id="landing-hero-title">
            Run Tavily + Brave through one resilient bridge.
          </h1>
          <p className="hero__subtitle">
            MCP Nexus centralizes multi-provider search orchestration with intelligent fallback,
            credit-aware key rotation, and a clean admin surface for production operations.
          </p>

          <div className="hero__cta">
            <a href="/admin" className="btn btn--primary">
              Get Started
            </a>
            <a
              href="https://github.com/anthropics/mcp-nexus"
              className="btn btn--secondary"
              target="_blank"
              rel="noreferrer"
              aria-label="View on GitHub (opens in a new tab)"
            >
              View on GitHub
            </a>
          </div>

          <ul className="hero__stats" aria-label="Platform summary statistics">
            {stats.map((stat) => (
              <li key={stat.label} className="hero__stat">
                <p className="hero__stat-value">{stat.value}</p>
                <p className="hero__stat-label">{stat.label}</p>
              </li>
            ))}
          </ul>
        </div>

        <aside className="hero__panel" aria-label="Core platform capabilities">
          <p className="hero__panel-eyebrow">Deployment-ready core</p>
          <h2 className="hero__panel-title">Designed for reliable MCP traffic</h2>
          <ul className="hero__panel-list">
            {highlights.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <a href="/health" className="hero__panel-link">
            Check live health endpoint →
          </a>
        </aside>
      </div>
    </section>
  );
}
