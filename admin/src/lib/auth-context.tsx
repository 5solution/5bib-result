"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  useAuth as useClerkAuth,
  useClerk,
  useUser,
} from "@clerk/nextjs";
import "./api"; // ensure client baseUrl is configured

interface AuthContextType {
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  /** Legacy signature — no-op (login qua Clerk UI, không gọi function này) */
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  userRole: string | null;
}

const AuthContext = createContext<AuthContextType | null>(null);

/**
 * Admin auth context — wrapper quanh Clerk để giữ API `useAuth()` cũ.
 * Các components sẽ tiếp tục dùng `const { token, isAuthenticated, logout }
 * = useAuth()` mà không phải sửa code.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const { isSignedIn, isLoaded, getToken } = useClerkAuth();
  const { signOut } = useClerk();
  const { user } = useUser();
  const [token, setToken] = useState<string | null>(null);
  const [tokenLoading, setTokenLoading] = useState(true);

  // Cache token để components đọc sync. Refresh mỗi 50s.
  useEffect(() => {
    let cancelled = false;
    if (!isLoaded) return;
    if (!isSignedIn) {
      setToken(null);
      setTokenLoading(false);
      return;
    }

    const fetchToken = async () => {
      try {
        const t = await getToken();
        if (!cancelled) setToken(t);
      } catch {
        if (!cancelled) setToken(null);
      } finally {
        if (!cancelled) setTokenLoading(false);
      }
    };
    fetchToken();
    const id = setInterval(fetchToken, 50_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [isLoaded, isSignedIn, getToken]);

  const userRole =
    (user?.publicMetadata as Record<string, unknown> | undefined)?.role as
      | string
      | null
      | undefined ?? null;

  const value: AuthContextType = {
    token,
    isAuthenticated: !!isSignedIn && !!token,
    isLoading: !isLoaded || tokenLoading,
    login: async () => {
      throw new Error(
        "login() không còn dùng — admin auth qua Clerk. Redirect đến /sign-in",
      );
    },
    logout: () => signOut({ redirectUrl: "/sign-in" }),
    userRole,
  };

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
