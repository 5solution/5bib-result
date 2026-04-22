'use client';

/**
 * Client-side hook to access the current Logto session via /api/logto/user.
 *
 * Replaces Clerk's useUser + useAuth. Returns the same shape across sign-in
 * states so components can do `if (user.isAuthenticated) ...`.
 *
 * Cached for 30s by React Query — header/badges re-render without spamming
 * the route handler.
 */

import { useQuery } from '@tanstack/react-query';

export interface LogtoClaims {
  sub?: string;
  email?: string;
  name?: string;
  picture?: string;
  username?: string;
  roles?: string[];
}

export interface LogtoUserInfo {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  username?: string;
  custom_data?: Record<string, unknown>;
}

export interface UseUserResult {
  isAuthenticated: boolean;
  isLoading: boolean;
  claims: LogtoClaims | null;
  userInfo: LogtoUserInfo | null;
  scopes: string[];
  /** Convenience — preferred display name (userInfo > claims > username). */
  displayName: string | null;
  /** Convenience — primary email. */
  email: string | null;
  /** Convenience — profile picture URL (custom avatar > OIDC picture). */
  imageUrl: string | null;
  /** Convenience — customData.customAvatarUrl set via backend. */
  customAvatarUrl: string | null;
}

export function useUser(): UseUserResult {
  const { data, isLoading } = useQuery({
    queryKey: ['logto-user'],
    queryFn: async () => {
      const res = await fetch('/api/logto/user', {
        credentials: 'same-origin',
      });
      if (!res.ok) throw new Error('Failed to load Logto context');
      return res.json() as Promise<{
        isAuthenticated: boolean;
        claims: LogtoClaims | null;
        userInfo: LogtoUserInfo | null;
        scopes: string[];
      }>;
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const claims = data?.claims ?? null;
  const userInfo = data?.userInfo ?? null;
  const customData = (userInfo?.custom_data as Record<string, unknown>) || {};
  const customAvatarUrl =
    (customData.customAvatarUrl as string | undefined) ?? null;

  return {
    isAuthenticated: !!data?.isAuthenticated,
    isLoading,
    claims,
    userInfo,
    scopes: data?.scopes ?? [],
    displayName:
      userInfo?.name || claims?.name || userInfo?.username || claims?.username || null,
    email: userInfo?.email || claims?.email || null,
    imageUrl: customAvatarUrl || userInfo?.picture || claims?.picture || null,
    customAvatarUrl,
  };
}
