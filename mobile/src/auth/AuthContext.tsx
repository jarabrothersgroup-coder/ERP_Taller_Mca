/**
 * AutomotiveOS Mobile — Auth context
 *
 * Provides the current session + login/logout to the React tree.
 * On mount it restores the session from secure storage (offline-first).
 */

import * as React from "react";
import { getSession, saveSession, clearSession, type Session } from "./session";
import { unregisterPushToken } from "../notifications/push";

interface AuthState {
  session: Session | null;
  loading: boolean;
  login: (slug: string, email: string, token: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = React.createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = React.useState<Session | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    getSession()
      .then(setSession)
      .finally(() => setLoading(false));
  }, []);

  const login = React.useCallback(async (slug: string, email: string, token: string) => {
    const next = { slug, email, token };
    await saveSession(next);
    setSession(next);
  }, []);

  const logout = React.useCallback(async () => {
    await clearSession();
    setSession(null);
    void unregisterPushToken();
  }, []);

  const value = React.useMemo<AuthState>(
    () => ({ session, loading, login, logout }),
    [session, loading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
