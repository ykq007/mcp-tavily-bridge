import { useEffect, useId, useRef, useState } from 'react';

const navLinks = [
  { href: '#features', label: 'Features' },
  { href: '/health', label: 'Health' },
  { href: 'https://github.com/anthropics/mcp-nexus', label: 'GitHub', external: true }
];

const focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function Navbar() {
  const mobileMenuId = useId();
  const mobileMenuTitleId = useId();
  const mobileMenuDescriptionId = useId();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const mobileMenuRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!mobileMenuOpen) return;

    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth > 768) {
        setMobileMenuOpen(false);
      }
    };

    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (!mobileMenuOpen) return;

    previousActiveElement.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButtonRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setMobileMenuOpen(false);
        return;
      }

      if (event.key !== 'Tab') return;

      const menu = mobileMenuRef.current;
      if (!menu) return;

      const focusable = Array.from(menu.querySelectorAll<HTMLElement>(focusableSelector)).filter((el) => !(el as any).disabled);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;

      if (!active || !menu.contains(active)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
        return;
      }

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      (previousActiveElement.current ?? menuButtonRef.current)?.focus();
    };
  }, [mobileMenuOpen]);

  const closeMenu = () => setMobileMenuOpen(false);

  return (
    <>
      <nav className="navbar" aria-label="Primary navigation">
        <div className="landing-shell navbar__container">
          <a href="/" className="navbar__brand">
            <span className="navbar__logo-wrap" aria-hidden="true">
              <svg className="navbar__logo" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
              </svg>
            </span>
            <span className="navbar__brand-text">MCP Nexus</span>
          </a>

          <div className="navbar__links">
            {navLinks.map((link) =>
              link.external ? (
                <a
                  key={link.label}
                  href={link.href}
                  className="navbar__link"
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`${link.label} (opens in a new tab)`}
                >
                  {link.label}
                </a>
              ) : (
                <a key={link.label} href={link.href} className="navbar__link">
                  {link.label}
                </a>
              )
            )}
          </div>

          <div className="navbar__actions">
            <span className="navbar__status">Realtime telemetry</span>
            <a href="/admin" className="btn btn--primary">
              Open Dashboard
            </a>
          </div>

          <button
            ref={menuButtonRef}
            type="button"
            className="navbar__menuButton"
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileMenuOpen}
            aria-controls={mobileMenuId}
            aria-haspopup="dialog"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="currentColor"
                d={
                  mobileMenuOpen
                    ? 'M18.3 5.7a1 1 0 0 1 0 1.4L13.4 12l4.9 4.9a1 1 0 1 1-1.4 1.4L12 13.4l-4.9 4.9a1 1 0 0 1-1.4-1.4l4.9-4.9-4.9-4.9a1 1 0 0 1 1.4-1.4l4.9 4.9 4.9-4.9a1 1 0 0 1 1.4 0Z'
                    : 'M4 6.5A1 1 0 0 1 5 5.5h14a1 1 0 1 1 0 2H5a1 1 0 0 1-1-1Zm0 5.5a1 1 0 0 1 1-1h14a1 1 0 1 1 0 2H5a1 1 0 0 1-1-1Zm0 5.5a1 1 0 0 1 1-1h14a1 1 0 1 1 0 2H5a1 1 0 0 1-1-1Z'
                }
              />
            </svg>
          </button>
        </div>
      </nav>

      {mobileMenuOpen ? (
        <div className="navbar__mobileOverlay" role="presentation" onClick={closeMenu}>
          <div
            id={mobileMenuId}
            className="navbar__mobileMenu"
            role="dialog"
            aria-modal="true"
            aria-labelledby={mobileMenuTitleId}
            aria-describedby={mobileMenuDescriptionId}
            ref={mobileMenuRef}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="navbar__mobileHeader">
              <div>
                <div id={mobileMenuTitleId} className="navbar__mobileTitle">
                  Navigation
                </div>
                <p id={mobileMenuDescriptionId} className="navbar__mobileDescription">
                  Choose a destination.
                </p>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                className="navbar__mobileClose"
                onClick={closeMenu}
                aria-label="Close navigation menu"
              >
                Close
              </button>
            </div>

            <div className="navbar__mobileLinks">
              {navLinks.map((link) =>
                link.external ? (
                  <a
                    key={link.label}
                    href={link.href}
                    className="navbar__mobileLink"
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`${link.label} (opens in a new tab)`}
                    onClick={closeMenu}
                  >
                    {link.label}
                  </a>
                ) : (
                  <a key={link.label} href={link.href} className="navbar__mobileLink" onClick={closeMenu}>
                    {link.label}
                  </a>
                )
              )}
              <a href="/admin" className="btn btn--primary navbar__mobileCta" onClick={closeMenu}>
                Open Dashboard
              </a>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
