"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import "./api"; // ensure client baseUrl is configured
import { authControllerLogin } from "./api-generated";

interface AuthContextType {
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const TOKEN_KEY = "5bib_admin_token";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const logoutRef = useRef<() => void>(() => {});

  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (stored) {
      setToken(stored);
    }
    setIsLoading(false);
  }, []);

  // Global fetch interceptor: auto-redirect to /login on 401
  useEffect(() => {
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (...args: Parameters<typeof fetch>) => {
      const res = await originalFetch(...args);
      if (res.status === 401 && !window.location.pathname.startsWith("/login")) {
        logoutRef.current();
        window.location.href = "/login";
      }
      return res;
    };
    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { data, error } = await authControllerLogin({
      body: { email, password },
    });

    if (error) {
      throw new Error("Sai email hoac mat khau");
    }

    const result = data as unknown as { access_token?: string; token?: string };
    const accessToken = result?.access_token || result?.token;

    if (!accessToken) {
      throw new Error("Khong nhan duoc token");
    }

    localStorage.setItem(TOKEN_KEY, accessToken);
    setToken(accessToken);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
  }, []);

  // Keep ref in sync so the fetch interceptor always calls the latest logout
  useEffect(() => {
    logoutRef.current = logout;
  }, [logout]);

  return (
    <AuthContext value={{
      token,
      isAuthenticated: !!token,
      isLoading,
      login,
      logout,
    }}>
      {children}
    </AuthContext>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
