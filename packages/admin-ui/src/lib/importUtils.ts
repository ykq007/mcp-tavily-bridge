export interface ImportPreview {
  valid: number;
  invalid: number;
  tavilyCount: number;
  braveCount: number;
}

export function parseJsonSafely(text: string): { data: any; error: string | null } {
  try {
    const data = JSON.parse(text);
    return { data, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Failed to parse JSON file' };
  }
}

export function validateImportData(json: any): ImportPreview {
  if (json.schemaVersion !== 1) {
    throw new Error('Invalid file format: schemaVersion must be 1');
  }

  if ((json.tavily !== undefined && !Array.isArray(json.tavily)) || (json.brave !== undefined && !Array.isArray(json.brave))) {
    throw new Error('Invalid file format: tavily and brave must be arrays if provided');
  }

  if (!Array.isArray(json.tavily) && !Array.isArray(json.brave)) {
    throw new Error('Invalid file format: at least one of tavily or brave must be provided');
  }

  // Ensure both arrays exist for backend compatibility
  if (!json.tavily) json.tavily = [];
  if (!json.brave) json.brave = [];

  const tavilyItems = json.tavily;
  const braveItems = json.brave;

  let valid = 0;
  let invalid = 0;

  for (const item of tavilyItems) {
    if (typeof item.label === 'string' && item.label.trim() && typeof item.apiKey === 'string' && item.apiKey.trim()) {
      valid++;
    } else {
      invalid++;
    }
  }

  for (const item of braveItems) {
    if (typeof item.label === 'string' && item.label.trim() && typeof item.apiKey === 'string' && item.apiKey.trim()) {
      valid++;
    } else {
      invalid++;
    }
  }

  return {
    valid,
    invalid,
    tavilyCount: tavilyItems.length,
    braveCount: braveItems.length
  };
}
