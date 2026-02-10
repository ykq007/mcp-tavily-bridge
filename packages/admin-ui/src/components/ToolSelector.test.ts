import { describe, expect, it } from 'vitest';

import { MCP_TOOLS, coerceMcpTool, isMcpTool } from './ToolSelector';

describe('ToolSelector tools', () => {
  it('does not include unsupported brave_news_search', () => {
    expect(MCP_TOOLS).not.toContain('brave_news_search');
  });

  it('validates supported MCP tools', () => {
    expect(isMcpTool('tavily_search')).toBe(true);
    expect(isMcpTool('brave_web_search')).toBe(true);
    expect(isMcpTool('brave_local_search')).toBe(true);
  });

  it('rejects unsupported tool values', () => {
    expect(isMcpTool('brave_news_search')).toBe(false);
    expect(isMcpTool('')).toBe(false);
    expect(isMcpTool(undefined)).toBe(false);
    expect(isMcpTool(null)).toBe(false);
  });

  it('coerces unsupported values to fallback', () => {
    expect(coerceMcpTool('brave_news_search')).toBe('tavily_search');
    expect(coerceMcpTool(undefined, 'brave_local_search')).toBe('brave_local_search');
    expect(coerceMcpTool('', 'brave_web_search')).toBe('brave_web_search');
  });

  it('keeps supported tool values unchanged', () => {
    expect(coerceMcpTool('tavily_search')).toBe('tavily_search');
    expect(coerceMcpTool('brave_web_search')).toBe('brave_web_search');
    expect(coerceMcpTool('brave_local_search')).toBe('brave_local_search');
  });
});
