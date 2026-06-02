import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, getStoredToken, setStoredToken } from '../api';

type AuthCtx = {
  token: string | null;
  username: string | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const me = await api.me();
      setUsername(me.username);
    } catch {
      setUsername(null);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const t = await getStoredToken();
      if (t) {
        setToken(t);
        try {
          const me = await api.me();
          setUsername(me.username);
        } catch {
          // invalid token, clear
          await setStoredToken(null);
          setToken(null);
        }
      }
      setLoading(false);
    })();
  }, []);

  const login = async (u: string, p: string) => {
    const res = await api.login(u, p);
    await setStoredToken(res.access_token);
    setToken(res.access_token);
    try { const me = await api.me(); setUsername(me.username); } catch {}
  };

  const logout = async () => {
    await setStoredToken(null);
    setToken(null);
    setUsername(null);
  };

  return <Ctx.Provider value={{ token, username, loading, login, logout, refresh }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth outside AuthProvider');
  return c;
}
