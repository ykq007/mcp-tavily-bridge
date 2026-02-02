import type { Tool } from '@modelcontextprotocol/sdk/types.js';

export const braveToolsV0100: Tool[] = [
  {
    name: 'brave_web_search',
    description:
      'Performs a web search using the Brave Search API. Use for general web searches for information, facts, and current topics. Returns a JSON array of results.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        count: { type: 'number', description: 'Number of results (1-20, default 10)', default: 10, minimum: 1, maximum: 20 },
        offset: { type: 'number', description: 'Pagination offset (0-9, default 0)', default: 0, minimum: 0, maximum: 9 }
      },
      required: ['query'],
      additionalProperties: true
    }
  },
  {
    name: 'brave_local_search',
    description:
      'Search for local businesses and places using the Brave Search API. Implementations commonly fall back to web search if local results are unavailable. Returns a JSON array of results.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Local search terms' },
        count: { type: 'number', description: 'Number of results (1-20, default 10)', default: 10, minimum: 1, maximum: 20 }
      },
      required: ['query'],
      additionalProperties: true
    }
  }
];

