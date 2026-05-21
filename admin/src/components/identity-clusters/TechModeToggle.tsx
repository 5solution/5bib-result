/**
 * F-049 — "Hiển thị thông tin kỹ thuật" toggle với localStorage persist.
 *
 * BR-49-06: techMode OFF by default. Persist trong localStorage
 * key `identity-clusters:tech-mode` per browser.
 */

"use client";

import { useSyncExternalStore } from "react";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ACTION_LABEL } from "@/lib/identity-cluster-labels";

const STORAGE_KEY = "identity-clusters:tech-mode";

/**
 * useSyncExternalStore-based localStorage hook — avoids set-state-in-effect
 * lint rule (React 19 strict). SSR-safe (returns false during SSR via
 * getServerSnapshot).
 */
function subscribe(callback: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function getSnapshot(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function getServerSnapshot(): boolean {
  return false;
}

// Hydration signal — always returns true on client (after subscribe runs).
function subscribeHydration(callback: () => void): () => void {
  // Trigger one re-render after mount via microtask
  if (typeof window !== "undefined") {
    queueMicrotask(callback);
  }
  return () => undefined;
}

function getHydratedSnapshot(): boolean {
  return true;
}

function getHydratedServerSnapshot(): boolean {
  return false;
}

export function useTechMode(): {
  techMode: boolean;
  setTechMode: (v: boolean) => void;
  hydrated: boolean;
} {
  // useSyncExternalStore returns false during SSR, real value after mount.
  // The "hydrated" flag is derived from whether we're running on client
  // (typeof window !== 'undefined') — checked at call site of subscribe.
  const techMode = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const setTechMode = (v: boolean) => {
    try {
      localStorage.setItem(STORAGE_KEY, v ? "true" : "false");
      // Manually dispatch storage event to trigger useSyncExternalStore re-read
      window.dispatchEvent(new Event("storage"));
    } catch {
      // silent
    }
  };

  // hydrated = derived via second useSyncExternalStore subscription.
  // SSR returns false, after mount (microtask) → notifies → re-renders true.
  // This avoids hydration mismatch (server + initial client render = false).
  const hydrated = useSyncExternalStore(
    subscribeHydration,
    getHydratedSnapshot,
    getHydratedServerSnapshot,
  );

  return { techMode, setTechMode, hydrated };
}

interface Props {
  techMode: boolean;
  onChange: (v: boolean) => void;
  hydrated: boolean;
}

export function TechModeToggle({ techMode, onChange, hydrated }: Props) {
  // Avoid Next.js hydration mismatch — render placeholder until client mount
  if (!hydrated) {
    return <div className="h-8 w-44" aria-hidden />;
  }
  return (
    <div className="flex items-center gap-2">
      <Switch
        id="tech-mode-toggle"
        checked={techMode}
        onCheckedChange={onChange}
      />
      <Label
        htmlFor="tech-mode-toggle"
        className="cursor-pointer text-xs text-stone-600"
      >
        {ACTION_LABEL.showTech}
      </Label>
    </div>
  );
}
