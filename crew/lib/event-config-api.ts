/**
 * v1.9 — Event feature config for crew portal.
 * Dual-mode fetch: SSR uses BACKEND_URL directly; browser uses Next.js proxy.
 */

const isServer = typeof window === "undefined";
const BACKEND_URL = isServer
  ? process.env.BACKEND_URL || "http://localhost:8081"
  : "";

function apiUrl(path: string): string {
  return `${BACKEND_URL}${path}`;
}

export interface EventFeaturesConfig {
  event_id: number;
  feature_mode: "full" | "lite";
  feature_nghiem_thu: boolean;
}

/**
 * Fetch feature config for an event via the TNV magic token.
 * Throws if the token is invalid or the request fails.
 */
export async function getEventConfigByToken(
  token: string,
): Promise<EventFeaturesConfig> {
  const res = await fetch(
    apiUrl(
      `/api/public/team-registration/${encodeURIComponent(token)}/event-config`,
    ),
    { cache: "no-store" },
  );
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { message?: string | string[] };
      if (body.message) {
        msg = Array.isArray(body.message) ? body.message.join("; ") : body.message;
      }
    } catch {
      // ignore parse error
    }
    throw new Error(msg);
  }
  return res.json() as Promise<EventFeaturesConfig>;
}
