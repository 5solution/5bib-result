'use client';

/**
 * F-015 Surface 3 — athlete preview card.
 *
 * Renders BIB hero, full name, course label, status badges (chip-verified,
 * racekit status), T-shirt size if present in master data. NEVER renders
 * forbidden internal/PII fields (CMND, full email, etc.) per BR-CK-10/15.
 */

import { ShieldCheck, Package, Clock } from 'lucide-react';
import { CHECKIN_COPY } from '../checkin.microcopy';
import type { AthleteCheckInPayload } from '../checkin.types';

interface AthleteCheckInCardProps {
  athlete: AthleteCheckInPayload;
}

function formatRacekitWhen(at?: string | null): string | null {
  if (!at) return null;
  try {
    const d = new Date(at);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return null;
  }
}

export function AthleteCheckInCard({ athlete }: AthleteCheckInCardProps) {
  const courseLabel = [athlete.course, athlete.courseDistance].filter(Boolean).join(' · ');
  const racekitWhen = formatRacekitWhen(athlete.racekitReceivedAt);
  return (
    <div
      className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm"
      data-testid="athlete-check-in-card"
    >
      <div className="font-mono text-7xl font-extrabold text-stone-900" data-testid="athlete-bib">
        {athlete.bib}
      </div>
      <div className="mt-2 text-3xl font-bold text-stone-900" data-testid="athlete-name">
        {athlete.name}
      </div>
      {courseLabel ? (
        <div className="mt-1 text-base text-stone-600" data-testid="athlete-course">
          {CHECKIN_COPY.result.courseLabel}: {courseLabel}
        </div>
      ) : null}
      {athlete.gender ? (
        <div className="mt-1 text-sm text-stone-500">{athlete.gender}</div>
      ) : null}
      {athlete.size ? (
        <div className="mt-1 text-sm text-stone-700">
          {CHECKIN_COPY.result.sizeLabel}: <span className="font-bold">{athlete.size}</span>
        </div>
      ) : null}
      {athlete.items ? (
        <div className="mt-1 text-sm text-stone-700">
          <Package className="mr-1 inline-block size-4 text-stone-500" aria-hidden />
          {athlete.items}
        </div>
      ) : null}

      {/* Status badges */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {athlete.chipVerified ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
            <ShieldCheck className="size-3.5" aria-hidden />
            {CHECKIN_COPY.result.chipBadge}
          </span>
        ) : null}
        {athlete.racekitReceived ? (
          <span
            className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800"
            data-testid="badge-racekit-already"
          >
            <Clock className="size-3.5" aria-hidden />
            {CHECKIN_COPY.result.racekitOkBadge}
            {racekitWhen ? ` · ${racekitWhen}` : null}
            {athlete.pickedUpAtStation ? ` · Station ${athlete.pickedUpAtStation}` : null}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-700">
            {CHECKIN_COPY.result.racekitWaitBadge}
          </span>
        )}
      </div>
    </div>
  );
}
