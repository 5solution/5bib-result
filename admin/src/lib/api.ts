import createClient from "openapi-fetch";
import type { paths } from "./api-types";

// Use empty string for relative URLs (proxy through Next.js API route)
const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

export const api = createClient<paths>({ baseUrl: API_URL });

// Helper to add auth header
export function authHeaders(token: string) {
  return { headers: { Authorization: `Bearer ${token}` } };
}
