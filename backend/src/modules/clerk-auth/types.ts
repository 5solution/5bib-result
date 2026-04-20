export interface ClerkUser {
  /** Clerk user ID — e.g. "user_2abc..." */
  clerkId: string;
  /** Primary email (from JWT claims) */
  email: string | null;
  /** Profile image URL from Clerk */
  imageUrl: string | null;
  /** Full name from Clerk */
  fullName: string | null;
  /** Session ID from JWT */
  sessionId: string;
  /** publicMetadata from JWT — small JSON blob */
  metadata: Record<string, unknown>;
}

declare module 'express' {
  interface Request {
    clerk?: ClerkUser;
  }
}
