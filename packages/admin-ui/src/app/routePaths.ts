export const ROUTE_PATHS = {
  overview: '/',
  keys: '/keys',
  tokens: '/tokens',
  usage: '/usage',
  playground: '/playground',
  settings: '/settings'
} as const;

/** Allow-list for safe in-app redirects after landing-page sign-in. */
export const NEXT_ALLOWED_PATHS_SET = new Set<string>(Object.values(ROUTE_PATHS));
