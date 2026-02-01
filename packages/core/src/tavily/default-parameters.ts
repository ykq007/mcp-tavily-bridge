export type DefaultParameters = Record<string, unknown>;

export function parseDefaultParametersJson(value: string | undefined): DefaultParameters {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return {};
    }
    return parsed as DefaultParameters;
  } catch {
    return {};
  }
}

export function getDefaultParametersFromEnv(): DefaultParameters {
  return parseDefaultParametersJson(process.env.DEFAULT_PARAMETERS);
}
