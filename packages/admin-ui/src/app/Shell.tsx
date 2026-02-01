import React from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { IconChevronLeft, IconChevronRight, IconKey, IconMoon, IconSearch, IconSettings, IconShield, IconSun, IconToken } from '../ui/icons';
import type { Theme } from './prefs';

export type PageId = 'overview' | 'keys' | 'tokens' | 'usage' | 'settings' | 'login';

interface NavItemDef {
  path: string;
  icon: React.ReactNode;
  label: string;
  requiresAuth: boolean;
}

const navItems: NavItemDef[] = [
  { path: '/', icon: <IconShield />, label: 'Overview', requiresAuth: true },
  { path: '/keys', icon: <IconKey />, label: 'Keys', requiresAuth: true },
  { path: '/tokens', icon: <IconToken />, label: 'Tokens', requiresAuth: true },
  { path: '/usage', icon: <IconSearch />, label: 'Usage', requiresAuth: true },
  { path: '/settings', icon: <IconSettings />, label: 'Settings', requiresAuth: false }
];

const pageInfo: Record<string, { title: string; subtitle: string }> = {
  '/': { title: 'Overview', subtitle: 'System status' },
  '/keys': { title: 'Tavily Keys', subtitle: 'Manage API key pool' },
  '/tokens': { title: 'Client Tokens', subtitle: 'Manage access tokens' },
  '/usage': { title: 'Usage', subtitle: 'What Tavily is used for' },
  '/settings': { title: 'Settings', subtitle: 'Preferences and configuration' }
};

export function ShellLayout({
  connectionSummary,
  theme,
  onToggleTheme,
  signedIn,
  sidebarCollapsed,
  onToggleSidebar
}: {
  connectionSummary: string;
  theme: Theme;
  onToggleTheme: () => void;
  signedIn: boolean;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
}) {
  const location = useLocation();
  const info = pageInfo[location.pathname] || { title: 'Admin', subtitle: '' };

  // Filter nav items based on auth state
  const visibleNavItems = navItems.filter((item) => signedIn || !item.requiresAuth);

  return (
    <div className={`appFrame${sidebarCollapsed ? ' sidebar-collapsed' : ''}`}>
      <div className="appShell">
        {/* Desktop Sidebar */}
        <aside className="sidebar">
          <div className="navHeader">
            <div className="navTitle">
              <IconShield title="Admin" />
              <div className="navTitleText">
                <div className="navBrand">Tavily Bridge</div>
                <div className="help">Admin console</div>
              </div>
            </div>
          </div>
          <nav className="nav" aria-label="Admin navigation">
            {visibleNavItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => `navItem${isActive ? ' navItem--active' : ''}`}
                data-active={location.pathname === item.path}
                end={item.path === '/'}
                title={sidebarCollapsed ? item.label : undefined}
              >
                <span className="navItemIcon">{item.icon}</span>
                <span className="navItemLabel">{item.label}</span>
              </NavLink>
            ))}
          </nav>
          <div className="navFooter">
            <button className="themeToggle" onClick={onToggleTheme} aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`} title={sidebarCollapsed ? (theme === 'light' ? 'Dark mode' : 'Light mode') : undefined}>
              {theme === 'light' ? <IconMoon /> : <IconSun />}
              <span>{theme === 'light' ? 'Dark mode' : 'Light mode'}</span>
            </button>
            <button className="sidebarToggle" onClick={onToggleSidebar} aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={sidebarCollapsed ? 'Expand' : 'Collapse'}>
              {sidebarCollapsed ? <IconChevronRight /> : <IconChevronLeft />}
              <span>{sidebarCollapsed ? 'Expand' : 'Collapse'}</span>
            </button>
            <div className="navConnectionInfo">
              <div className="help">Connection</div>
              <div className="mono navConnectionSummary">
                {connectionSummary}
              </div>
            </div>
          </div>
        </aside>

        <main className="mainPanel">
          <header className="appHeader">
            <div className="topbarTitle">
              <div className="h1">{info.title}</div>
              <div className="help">{info.subtitle}</div>
            </div>
          </header>
          <div className="mainBody">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="mobileNav" aria-label="Mobile navigation">
        {visibleNavItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className="mobileNavItem"
            data-active={location.pathname === item.path}
            aria-label={item.label}
            aria-current={location.pathname === item.path ? 'page' : undefined}
            end={item.path === '/'}
          >
            {item.icon}
            <span>{item.label}</span>
          </NavLink>
        ))}
        <button
          className="mobileNavItem"
          onClick={onToggleTheme}
          aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
        >
          {theme === 'light' ? <IconMoon /> : <IconSun />}
          <span>Theme</span>
        </button>
      </nav>
    </div>
  );
}
