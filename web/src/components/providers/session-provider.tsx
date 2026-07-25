"use client";

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { useRouter } from "next/navigation";

interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
  tenantSlug: string;
  tenantName: string;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (tenantSlug: string, email: string, password: string) => Promise<{ error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const storedToken = localStorage.getItem("auth_token");
      const storedUser = localStorage.getItem("auth_user");
      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      }
    } catch {
      // Ignore parse errors
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (tenantSlug: string, email: string, password: string) => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantSlug, email, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        return { error: data.error || "Credenciales inválidas" };
      }
      const authUser: AuthUser = {
        id: data.profile.id,
        email: data.profile.email,
        fullName: data.profile.full_name,
        role: data.profile.role,
        tenantSlug: data.tenant.slug,
        tenantName: data.tenant.name,
      };
      localStorage.setItem("auth_token", data.token);
      localStorage.setItem("auth_user", JSON.stringify(authUser));
      setToken(data.token);
      setUser(authUser);
      // Set cookie for middleware auth check
      document.cookie = `auth_token=${data.token}; path=/; max-age=${8 * 60 * 60}; SameSite=Lax`;
      return {};
    } catch {
      return { error: "Error de conexión" };
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_user");
    document.cookie = "auth_token=; path=/; max-age=0; SameSite=Lax";
    setToken(null);
    setUser(null);
    router.push("/sign-in");
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, token, loading, isAuthenticated: !!token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <SessionProvider>");
  return ctx;
}
