'use client';

/**
 * F-014 — Advanced section.
 *
 * Hosts: BrandingForm + SponsorsTable + RaceCertificateConfigPanel
 * (v1.1 black-box composite preserved verbatim per BR-AF-23 row #83).
 */

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import RaceCertificateConfigPanel from '@/components/certificates/RaceCertificateConfigPanel';
import { BrandingForm } from './BrandingForm';
import { SponsorsTable } from './SponsorsTable';
import type { Course, EditForm, Race } from '../section-shared.types';

interface AdvancedSectionProps {
  raceId: string;
  race: Race;
  editForm: EditForm;
  onEditFormChange: (next: EditForm) => void;
  onRefetch: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}

export function AdvancedSection(props: AdvancedSectionProps) {
  const { raceId, race, editForm, onEditFormChange, onRefetch, onDirtyChange } =
    props;

  return (
    <section
      id="advanced"
      className="scroll-mt-24 flex flex-col gap-6"
      aria-labelledby="advanced-heading"
    >
      <h2 id="advanced-heading" className="sr-only">
        Nâng cao
      </h2>

      <BrandingForm
        raceId={raceId}
        editForm={editForm}
        onEditFormChange={onEditFormChange}
        onRefetch={onRefetch}
        onDirtyChange={onDirtyChange}
      />

      <SponsorsTable raceId={raceId} />

      <Card>
        <CardHeader>
          <CardTitle>Certificate Templates</CardTitle>
          <CardDescription>
            Cấu hình template chứng nhận và share card cho giải này (v1.1).
            Chạy song song với hệ thống cũ — không ảnh hưởng tính năng hiện có.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RaceCertificateConfigPanel
            raceId={raceId}
            courses={(race.courses ?? []).map((c: Course) => ({
              courseId: c.courseId,
              name: c.name ?? c.distance,
              distance: c.distance,
            }))}
          />
        </CardContent>
      </Card>
    </section>
  );
}

export default AdvancedSection;
