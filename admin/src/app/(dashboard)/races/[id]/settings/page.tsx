'use client';

/**
 * F-014 — Settings page (REWRITE: 1692 LOC → ~200 LOC composer).
 *
 * Composition:
 *   <Header (race title + status badge + cross-cutting nav buttons)>
 *   <SettingsLayout sections=…>
 *     <RaceMetaSection />
 *     <CourseSection />
 *     <TimingSection />
 *     <PublishingSection />
 *     <IntegrationsSection />
 *     <AdvancedSection />
 *   </SettingsLayout>
 *
 * BR-AF-23 byte-for-byte preserve: every field from PAUSE-AS-02 mapping
 * is present in one of the section components. Save buttons preserved
 * per-section (4 legacy → 5 sections, equivalent semantics — BR-AS-42).
 *
 * State: single `race` + `editForm` lives at this level (matches legacy);
 * sections call `onEditFormChange` to bubble up. `useDirtyFormPerSection`
 * hooks per-section dirty state → chấm cam in left rail (BR-AS-28).
 */

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Pencil,
  RadioTower,
  ShieldAlert,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import '@/lib/api';
import { authHeaders } from '@/lib/api';
import { racesControllerGetRaceById } from '@/lib/api-generated';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { SettingsLayout } from './SettingsLayout';
import { RaceMetaSection } from './sections/RaceMetaSection/RaceMetaSection';
import { CourseSection } from './sections/CourseSection/CourseSection';
import { TimingSection } from './sections/TimingSection/TimingSection';
import { PublishingSection } from './sections/PublishingSection/PublishingSection';
import { IntegrationsSection } from './sections/IntegrationsSection/IntegrationsSection';
import { AdvancedSection } from './sections/AdvancedSection/AdvancedSection';
import { useDirtyFormPerSection } from './hooks/useDirtyFormPerSection';
import {
  SECTION_IDS,
  type EditForm,
  type Race,
  type RaceStatus,
} from './sections/section-shared.types';

function StatusPill({ status }: { status: RaceStatus }) {
  const map: Record<RaceStatus, { label: string; bg: string; text: string }> = {
    draft: {
      label: 'Nháp',
      bg: 'bg-yellow-50',
      text: 'text-yellow-800',
    },
    pre_race: {
      label: 'Chuẩn bị',
      bg: 'bg-blue-50',
      text: 'text-blue-800',
    },
    live: {
      label: 'Đang diễn ra',
      bg: 'bg-green-50',
      text: 'text-green-800',
    },
    ended: {
      label: 'Đã kết thúc',
      bg: 'bg-zinc-100',
      text: 'text-zinc-700',
    },
  };
  const c = map[status] ?? map.ended;
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${c.bg} ${c.text}`}
    >
      {c.label}
    </span>
  );
}

export default function RaceSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const { token } = useAuth();
  const raceId = String((params as { id?: string }).id ?? '');

  const [race, setRace] = useState<Race | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({});
  const [loading, setLoading] = useState(true);

  const dirty = useDirtyFormPerSection();

  const fetchRace = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const { data, error } = await racesControllerGetRaceById({
        path: { id: raceId },
        ...authHeaders(token),
      });
      if (error) throw new Error('Race not found');
      const body = data as { data?: Race } | Race;
      const raceData =
        ((body as { data?: Race }).data ?? (body as Race)) as Race;
      setRace(raceData);
      setEditForm({
        title: raceData.title,
        slug: raceData.slug,
        status: raceData.status,
        raceType: raceData.raceType,
        province: raceData.province,
        location: raceData.location,
        organizer: raceData.organizer,
        startDate: raceData.startDate,
        endDate: raceData.endDate,
        description: raceData.description,
        season: raceData.season,
        imageUrl: raceData.imageUrl,
        logoUrl: raceData.logoUrl,
        bannerUrl: raceData.bannerUrl,
        brandColor: raceData.brandColor,
        sponsorBanners: raceData.sponsorBanners || [],
        enableEcert: raceData.enableEcert ?? false,
        enableClaim: raceData.enableClaim ?? false,
        enableLiveTracking: raceData.enableLiveTracking ?? false,
        enable5pix: raceData.enable5pix ?? false,
        pixEventUrl: raceData.pixEventUrl,
        cacheTtlSeconds: raceData.cacheTtlSeconds ?? 60,
        enableHideStats: raceData.enableHideStats ?? false,
        enablePrivateList: raceData.enablePrivateList ?? false,
        privateListLimit: raceData.privateListLimit ?? 20,
      });
      dirty.clearAll();
    } catch {
      toast.error('Không thể tải thông tin giải');
    } finally {
      setLoading(false);
    }
  }, [token, raceId, dirty]);

  useEffect(() => {
    fetchRace();
  }, [fetchRace]);

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!race) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <p className="text-muted-foreground">Không tìm thấy giải</p>
        <Button variant="outline" onClick={() => router.push('/races')}>
          Quay lại
        </Button>
      </div>
    );
  }

  const sections = [
    {
      id: SECTION_IDS.raceMeta,
      label: 'Thông tin giải',
      hint: 'Lifecycle, identity, place & time',
      dirty: !!dirty.dirtyMap[SECTION_IDS.raceMeta],
    },
    {
      id: SECTION_IDS.course,
      label: 'Cự ly',
      hint: 'Course table + map deep-link',
      dirty: !!dirty.dirtyMap[SECTION_IDS.course],
    },
    {
      id: SECTION_IDS.timing,
      label: 'Timing & Phát hiện',
      hint: 'F-008/F-010/F-012 stack',
      dirty: !!dirty.dirtyMap[SECTION_IDS.timing],
    },
    {
      id: SECTION_IDS.publishing,
      label: 'Tính năng',
      hint: 'Toggles + Privacy',
      dirty: !!dirty.dirtyMap[SECTION_IDS.publishing],
    },
    {
      id: SECTION_IDS.integrations,
      label: 'Tích hợp',
      hint: 'Cache TTL + sync cross-link',
      dirty: !!dirty.dirtyMap[SECTION_IDS.integrations],
    },
    {
      id: SECTION_IDS.advanced,
      label: 'Nâng cao',
      hint: 'Branding + Sponsors + Certificates',
      dirty: !!dirty.dirtyMap[SECTION_IDS.advanced],
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push('/races')}
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="font-display text-2xl font-bold tracking-tight text-gray-900">
            {race.title}
          </h1>
          <p className="text-sm text-muted-foreground">{race.slug}</p>
        </div>
        <StatusPill status={race.status} />
        <Link href={`/races/${raceId}/master-data`}>
          <Button variant="outline" size="sm">
            <Pencil className="size-4 mr-1.5" />
            Master Data
          </Button>
        </Link>
        <Link href={`/races/${raceId}/chip-mappings`}>
          <Button variant="outline" size="sm">
            <RadioTower className="size-4 mr-1.5" />
            Chip Verify
          </Button>
        </Link>
        <Link href={`/races/${raceId}/timing-alerts`}>
          <Button variant="outline" size="sm">
            <ShieldAlert className="size-4 mr-1.5" />
            Timing Alerts
          </Button>
        </Link>
        <Link href={`/races/${raceId}/results`}>
          <Button variant="outline" size="sm">
            <Pencil className="size-4 mr-1.5" />
            Sửa kết quả
          </Button>
        </Link>
      </div>

      <SettingsLayout sections={sections}>
        <RaceMetaSection
          raceId={raceId}
          race={race}
          editForm={editForm}
          onEditFormChange={setEditForm}
          onRefetch={fetchRace}
          onDirtyChange={(d) => dirty.setDirty(SECTION_IDS.raceMeta, d)}
        />
        <CourseSection
          raceId={raceId}
          race={race}
          onRefetch={fetchRace}
        />
        <TimingSection raceId={raceId} />
        <PublishingSection
          raceId={raceId}
          editForm={editForm}
          onEditFormChange={setEditForm}
          onRefetch={fetchRace}
          onDirtyChange={(d) => dirty.setDirty(SECTION_IDS.publishing, d)}
        />
        <IntegrationsSection
          raceId={raceId}
          editForm={editForm}
          onEditFormChange={setEditForm}
          onRefetch={fetchRace}
          onDirtyChange={(d) => dirty.setDirty(SECTION_IDS.integrations, d)}
        />
        <AdvancedSection
          raceId={raceId}
          race={race}
          editForm={editForm}
          onEditFormChange={setEditForm}
          onRefetch={fetchRace}
          onDirtyChange={(d) => dirty.setDirty(SECTION_IDS.advanced, d)}
        />
      </SettingsLayout>
    </div>
  );
}
