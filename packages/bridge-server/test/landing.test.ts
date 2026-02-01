import { describe, expect, it } from 'vitest';
import { renderLandingPage } from '../src/landing.js';

describe('landing', () => {
  it('renders core links and does not embed secrets', () => {
    const html = renderLandingPage({
      githubUrl: 'https://github.com/example/repo',
      adminPath: '/admin-ui',
      healthPath: '/health'
    });

    expect(html).toContain('mcp-tavily-bridge');
    expect(html).toContain('href="/admin-ui"');
    expect(html).toContain("fetch('/health'");

    expect(html).not.toContain('ADMIN_API_TOKEN');
    expect(html).not.toContain('KEY_ENCRYPTION_SECRET');
    expect(html).not.toContain('DATABASE_URL');
  });
});

