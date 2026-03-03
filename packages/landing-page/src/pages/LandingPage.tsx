import { useCallback, useEffect, useState } from 'react';
import { Navbar } from '../components/Navbar';
import { Hero } from '../components/Hero';
import { Features } from '../components/Features';
import { Footer } from '../components/Footer';
import { AdminLoginModal } from '../components/AdminLoginModal';
import {
  ADMIN_LOCAL_TOKEN_KEY,
  ADMIN_SESSION_TOKEN_KEY,
  loadAdminToken,
  persistAdminToken,
  persistRememberAdminTokenPreference
} from '../lib/adminAuth';
import { buildAdminDashboardUrl, sanitizeAdminNext, shouldAutoOpenLoginModal } from '../lib/adminRouting';
import '../styles/landing.css';

function getInitialLandingAuthState(): { requestedNext: string; shouldOpenLoginModal: boolean } {
  if (typeof window === 'undefined') {
    return { requestedNext: '/', shouldOpenLoginModal: false };
  }

  const searchParams = new URLSearchParams(window.location.search);
  return {
    requestedNext: sanitizeAdminNext(searchParams.get('next')),
    shouldOpenLoginModal: shouldAutoOpenLoginModal(searchParams)
  };
}

export function LandingPage() {
  const [initialState] = useState(getInitialLandingAuthState);
  const [requestedNext, setRequestedNext] = useState(initialState.requestedNext);
  const [signedIn, setSignedIn] = useState(() => loadAdminToken().trim().length > 0);
  const [loginModalOpen, setLoginModalOpen] = useState(false);

  useEffect(() => {
    if (!signedIn && initialState.shouldOpenLoginModal) {
      setLoginModalOpen(true);
    }
  }, [signedIn, initialState.shouldOpenLoginModal]);

  useEffect(() => {
    if (!signedIn) return;
    if (!initialState.shouldOpenLoginModal) return;
    if (typeof window === 'undefined') return;
    window.location.replace(buildAdminDashboardUrl(requestedNext));
  }, [signedIn, initialState.shouldOpenLoginModal, requestedNext]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const onStorage = (event: StorageEvent) => {
      if (!event.key) return;
      if (event.key !== ADMIN_SESSION_TOKEN_KEY && event.key !== ADMIN_LOCAL_TOKEN_KEY) return;
      setSignedIn(loadAdminToken().trim().length > 0);
    };

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const openDashboard = useCallback((next?: string) => {
    const safeNext = sanitizeAdminNext(next ?? requestedNext);
    setRequestedNext(safeNext);

    if (signedIn) {
      window.location.assign(buildAdminDashboardUrl(safeNext));
      return;
    }

    setLoginModalOpen(true);
  }, [requestedNext, signedIn]);

  const handleLoginSuccess = useCallback((opts: { adminToken: string; remember: boolean }) => {
    persistAdminToken(opts.adminToken, opts.remember);
    persistRememberAdminTokenPreference(opts.remember);
    setSignedIn(true);
    setLoginModalOpen(false);
    window.location.assign(buildAdminDashboardUrl(requestedNext));
  }, [requestedNext]);

  const closeLoginModal = useCallback(() => {
    setLoginModalOpen(false);
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    params.delete('next');
    params.delete('login');
    params.delete('adminLogin');
    const search = params.toString();
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${search ? `?${search}` : ''}${window.location.hash}`
    );
  }, []);

  return (
    <div className="landing">
      <Navbar onOpenDashboard={() => openDashboard()} />
      <main className="landing__main">
        <Hero onOpenDashboard={() => openDashboard()} />
        <Features />
      </main>
      <Footer onOpenDashboard={() => openDashboard()} />

      <AdminLoginModal
        open={loginModalOpen}
        onClose={closeLoginModal}
        onSuccess={handleLoginSuccess}
      />
    </div>
  );
}

