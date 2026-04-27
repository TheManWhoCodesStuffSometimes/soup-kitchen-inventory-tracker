import React, { useEffect, useState } from 'react';
import { checkAuth } from '../services/apiClient';
import { Login } from './Login';
import { Spinner } from './ui';

interface AuthGateProps {
  children: React.ReactNode;
}

export const AuthGate: React.FC<AuthGateProps> = ({ children }) => {
  const [state, setState] = useState<'checking' | 'authed' | 'guest'>('checking');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const ok = await checkAuth();
        if (!cancelled) setState(ok ? 'authed' : 'guest');
      } catch {
        if (!cancelled) setState('guest');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (state === 'checking') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Spinner className="w-8 h-8" />
      </div>
    );
  }

  if (state === 'guest') {
    return <Login onLoggedIn={() => setState('authed')} />;
  }

  return <>{children}</>;
};
