/**
 * Whitelist-based sanitization for the `next` redirect parameter.
 * Prevents open redirect vulnerabilities by only allowing known internal paths.
 */

const ALLOWED_PATHS = new Set(['/', '/keys', '/tokens', '/usage']);

export function sanitizeNext(rawNext: string | null | undefined): string {
  if (!rawNext) return '/';

  // Must be an in-app absolute path (not protocol-relative, not URL)
  if (!rawNext.startsWith('/')) return '/';
  if (rawNext.startsWith('//')) return '/';

  // Split off query, validate only the path part
  const questionIndex = rawNext.indexOf('?');
  const path = questionIndex === -1 ? rawNext : rawNext.slice(0, questionIndex);
  const query = questionIndex === -1 ? '' : rawNext.slice(questionIndex);

  if (!ALLOWED_PATHS.has(path)) return '/';

  return query ? `${path}${query}` : path;
}
