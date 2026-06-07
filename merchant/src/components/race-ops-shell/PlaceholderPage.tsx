"use client";

/**
 * F-007 BR-AF-24 — shared placeholder card for tabs whose full impl ships in
 * a later cluster feature (F-008..F-013). Reads race title from the SDK so the
 * PageHero shows the correct race name even on a stand-alone visit.
 */

import { ReactNode, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import "@/lib/api";
import { authHeaders } from "@/lib/api";
import { racesControllerGetRaceById } from "@/lib/api-generated";
import { PageHero, type PageHeroVariant } from "./PageHero";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export interface PlaceholderPageProps {
  eyebrow: string;
  /** Heading shown on the placeholder card body. */
  comingSoonTitle: string;
  /** F-XXX badge label, e.g. "F-008 · Sprint sắp tới". */
  featureBadge: string;
  /** Body description (Vietnamese). */
  description: string;
  /** Optional extra UI under the description (links, hints). */
  extra?: ReactNode;
  variant?: PageHeroVariant;
  /** Optional subtitle/meta line under PageHero title. */
  meta?: string;
}

export function PlaceholderPage({
  eyebrow,
  comingSoonTitle,
  featureBadge,
  description,
  extra,
  variant = "white",
  meta,
}: PlaceholderPageProps) {
  const params = useParams();
  const raceId = String((params as { id?: string }).id ?? "");
  const { token } = useAuth();
  const [title, setTitle] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    if (!token || !raceId) return;
    (async () => {
      try {
        const { data } = await racesControllerGetRaceById({
          path: { id: raceId },
          ...authHeaders(token),
        });
        const body = data as { data?: { title: string } } | { title: string };
        const t = ((body as { data?: { title: string } })?.data ?? (body as { title: string }))
          ?.title;
        if (!cancelled && t) setTitle(t);
      } catch {
        /* noop */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, raceId]);

  return (
    <div className="flex flex-col gap-6">
      <PageHero
        variant={variant}
        eyebrow={eyebrow}
        title={title || "..."}
        meta={meta}
      />
      <Card>
        <CardContent className="flex flex-col items-start gap-3 py-10">
          {!title ? <Skeleton className="h-5 w-48" /> : null}
          <span className="inline-flex items-center gap-2 rounded-full bg-stone-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-stone-600">
            {featureBadge}
          </span>
          <h2 className="font-display text-xl font-bold text-stone-900">{comingSoonTitle}</h2>
          <p className="max-w-prose text-sm text-stone-600">{description}</p>
          {extra}
        </CardContent>
      </Card>
    </div>
  );
}
