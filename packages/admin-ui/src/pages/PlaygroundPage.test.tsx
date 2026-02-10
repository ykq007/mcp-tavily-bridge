import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PlaygroundPage } from './PlaygroundPage';

// Mock everything needed for static render
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('../components/JsonViewer', () => ({
  JsonViewer: () => <div className="json-viewer-mock" />,
}));

vi.mock('../components/ToolSelector', () => ({
  ToolSelector: () => <div className="tool-selector-mock" />,
  MCP_TOOLS: ['tavily_search'],
}));

// Mock icons
vi.mock('../ui/icons', () => ({
  IconRefresh: () => <svg className="icon-refresh" />,
  IconSearch: () => <svg className="icon-search" />,
  IconTrash: () => <svg className="icon-trash" />,
  IconInfo: () => <svg className="icon-info" />,
  IconCheck: () => <svg className="icon-check" />,
  IconAlertCircle: () => <svg className="icon-alert" />,
}));

// Mock localStorage because useStickyState uses it
const localStorageMock = (function () {
  let store: Record<string, string> = {};
  return {
    getItem: function (key: string) {
      return store[key] || null;
    },
    setItem: function (key: string, value: string) {
      store[key] = value.toString();
    },
    clear: function () {
      store = {};
    },
    removeItem: function (key: string) {
      delete store[key];
    },
  };
})();

// Assign to global.window
global.window = {
  localStorage: localStorageMock,
  location: { origin: 'http://localhost:5173' },
} as any;

describe('PlaygroundPage', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('renders initial state', () => {
    const html = renderToStaticMarkup(<PlaygroundPage />);

    expect(html).toContain('Playground');
    expect(html).toContain('Test MCP tools in real-time');
    expect(html).toContain('Client Token');
    expect(html).toContain('tool-selector-mock');
  });
});