"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useQuery } from "@tanstack/react-query";
import "./api"; // ensure client baseUrl is configured

interface LogtoUserInfo {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  username?: string;
  roles?: string[];
  scopes?: string[];
  custom_data?: Record<string, unknown>;
}

interface AuthContextType {
  /** Kept for API compat — always null now (access token is injected server-side by the proxy). */
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  /** No-op. Legacy bcrypt login removed. Use /api/logto/sign-in instead. */
  login: (email: string, password: string) => Promise<void>;
  /** Redirects to Logto end-session endpoint. */
  logout: () => void;
  userRole: string | null;
  /** Logto userInfo response (claims + custom_data). */
  userInfo: LogtoUserInfo | null;
  /**
   * Check user có scope cụ thể không. `all` (super admin) luôn pass mọi check.
   * Hierarchy: `staff` < `admin` < `all`.
   */
  hasScope: (scope: string) => boolean;
  /** Check user có role cụ thể không. `super_admin` luôn pass mọi check. */
  hasRole: (role: string) => boolean;
  /** True khi user là admin hoặc cao hơn (admin / super_admin / scope `admin`+`all`). */
  isAdmin: boolean;
  /** True khi user là staff hoặc cao hơn (bao gồm admin / super_admin). */
  isStaff: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

/**
 * Admin auth context — wraps the Logto `/api/logto/user` response so downstream
 * components keep consuming `useAuth()` with the same shape as the Clerk era.
 *
 * Token plumbing is now invisible to clients: the `/api/[...proxy]` route
 * pulls a Logto access token server-side and forwards it as `Authorization`
 * before proxying to backend. Components just `fetch('/api/...')`.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const { data, isLoading } = useQuery({
    queryKey: ["logto-user"],
    queryFn: async () => {
      const res = await fetch("/api/logto/user", {
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error("Failed to load Logto context");
      return res.json() as Promise<{
        isAuthenticated: boolean;
        userInfo: LogtoUserInfo | null;
        claims: LogtoUserInfo | null;
      }>;
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const [redirecting, setRedirecting] = useState(false);

  const isAuthenticated = !!data?.isAuthenticated;
  const userInfo = data?.userInfo ?? data?.claims ?? null;
  const roles = (userInfo?.roles as string[] | undefined) ?? [];
  const scopes = (userInfo?.scopes as string[] | undefined) ?? [];
  const userRole = roles.includes("admin")
    ? "admin"
    : roles.includes("staff")
      ? "staff"
      : roles[0] ?? null;

  // Permission hierarchy: staff < admin < all (super admin).
  const hasScope = (scope: string): boolean =>
    scopes.includes(scope) || scopes.includes("all");
  const hasRole = (role: string): boolean =>
    roles.includes(role) || roles.includes("super_admin");
  const isAdmin =
    hasScope("admin") || hasScope("all") || hasRole("admin") || hasRole("super_admin");
  const isStaff =
    isAdmin || hasScope("staff") || hasRole("staff");

  useEffect(() => {
    // Legacy LOCAL_STORAGE token cleanup — remove on first mount
    try {
      localStorage.removeItem("5bib_admin_token");
    } catch {
      /* ignore */
    }
  }, []);

  const value: AuthContextType = {
    // Sentinel string — legacy pages gate on `if (!token) return`.
    // Actual auth token is injected by the server-side proxy route.
    token: isAuthenticated ? "logto-session" : null,
    isAuthenticated,
    isLoading: isLoading || redirecting,
    login: async () => {
      setRedirecting(true);
      window.location.href = "/api/logto/sign-in";
      // Wait forever — redirect takes over
      await new Promise(() => {});
    },
    logout: () => {
      setRedirecting(true);
      window.location.href = "/api/logto/sign-out";
    },
    userRole,
    userInfo,
    hasScope,
    hasRole,
    isAdmin,
    isStaff,
  };

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
