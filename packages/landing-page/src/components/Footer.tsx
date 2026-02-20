export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="landing-shell footer__container">
        <div className="footer__brand">
          <p className="footer__brand-name">MCP Nexus</p>
          <p className="footer__text">© {currentYear} MCP Nexus. Multi-provider search bridge.</p>
        </div>

        <nav className="footer__links" aria-label="Footer links">
          <a href="/admin" className="footer__link">
            Admin Dashboard
          </a>
          <a href="/health" className="footer__link">
            Health Status
          </a>
          <a
            href="https://github.com/anthropics/mcp-nexus"
            className="footer__link"
            target="_blank"
            rel="noreferrer"
            aria-label="GitHub (opens in a new tab)"
          >
            GitHub
          </a>
        </nav>
      </div>

      <div className="landing-shell footer__bottom">
        <p className="footer__bottom-text">
          Built for teams operating provider-backed MCP workloads with reliability and visibility.
        </p>
      </div>
    </footer>
  );
}
