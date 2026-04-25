/**
 * GTM / dataLayer helper — safe to call from any client component.
 * Always guards against SSR and initialises dataLayer if missing.
 */
export function dl(payload: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  const w = window as Window & { dataLayer?: Record<string, unknown>[] };
  w.dataLayer = w.dataLayer ?? [];
  w.dataLayer.push(payload);
}
