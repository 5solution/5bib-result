'use client';

/**
 * F-014 BR-AS-31..34 — Timing & Detection section.
 *
 * Composition (14 fields per PAUSE-AS-02 audit rows #6–#21):
 *   - F-008v2 link cards (×2) at top — re-imported from
 *     `command-center/components/SettingsLinkCardsSection.tsx` (BR-AF-23
 *     preserved untouched, just re-rooted into this section).
 *   - F-010 form `TimingDetectionConfigSection` — 3 preset buttons +
 *     4 numeric inputs + Save (preserved verbatim).
 *   - F-012 hint surfaces nested INSIDE F-010 form (already wired in
 *     `TimingDetectionConfigSection`). No additional plumbing here.
 *
 * Total stack pieces preserved: 2 (F-008v2) + 1 (F-009 lives under Course)
 * + 1 form (F-010) + 3 hint surfaces (F-012) = 7 → matches BR-AF-23 audit.
 */

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { SettingsLinkCardsSection } from '../../../command-center/components/SettingsLinkCardsSection';
import TimingDetectionConfigSection from '../../components/TimingDetectionConfigSection';

interface TimingSectionProps {
  raceId: string;
}

export function TimingSection({ raceId }: TimingSectionProps) {
  return (
    <section id="timing" className="scroll-mt-24" aria-labelledby="timing-heading">
      <Card>
        <CardHeader>
          <CardTitle id="timing-heading">Timing & Phát hiện sự cố</CardTitle>
          <CardDescription>
            Cấu hình ngưỡng phát hiện athlete chậm/lạc + truy cập nhanh tới
            Timing Alert config và Poll logs.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {/* F-008v2 — 2 link cards (Timing Alert config + Poll logs).
              BR-AF-23 byte-for-byte preserve: imported as-is. */}
          <SettingsLinkCardsSection raceId={raceId} />

          {/* F-010 form + nested F-012 hint surfaces (×3).
              BR-AF-23 byte-for-byte preserve. */}
          <TimingDetectionConfigSection raceId={raceId} />
        </CardContent>
      </Card>
    </section>
  );
}

export default TimingSection;
