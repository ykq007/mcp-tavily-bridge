import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { sanitizeNext } from '../lib/sanitizeNext';

interface RequireAuthProps {
  adminToken: string;
}

/**
 * Route guard that redirects unauthenticated users to the login page.
 * Preserves the intended destination in the `next` query parameter.
 */
export function RequireAuth({ adminToken }: RequireAuthProps) {
  const location = useLocation();

  if (adminToken.trim()) {
    return <Outlet />;
  }

  const currentPath = `${location.pathname}${location.search}`;
  const safeNext = sanitizeNext(currentPath);
  const loginUrl = `/login?next=${encodeURIComponent(safeNext)}`;

  return <Navigate to={loginUrl} replace />;
}
