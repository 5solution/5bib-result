/**
 * F-014 — Shared types for Settings section components.
 *
 * Kept colocated to avoid leaking section-internal concerns into the
 * top-level page. Race / Course / Sponsor types mirror the legacy
 * page.tsx interfaces verbatim (BR-AF-23 byte-for-byte preserve).
 */

export type RaceStatus = 'draft' | 'pre_race' | 'live' | 'ended';

export interface CheckpointServices {
  water: boolean;
  food: boolean;
  sleep: boolean;
  dropBag: boolean;
  medical: boolean;
  notes?: string;
}

export interface Checkpoint {
  key: string;
  name: string;
  distance?: string;
  services?: CheckpointServices;
}

export interface Course {
  courseId: string;
  name: string;
  distance?: string;
  distanceKm?: number;
  courseType?: string;
  apiFormat?: string;
  apiUrl?: string;
  imageUrl?: string;
  elevationGain?: number;
  cutOffTime?: string;
  startTime?: string;
  startLocation?: string;
  mapUrl?: string;
  gpxUrl?: string;
  checkpoints?: Checkpoint[];
}

export interface StatusHistoryEntry {
  from: string;
  to: string;
  reason: string;
  changedBy: string;
  changedAt: string;
}

export interface Race {
  _id: string;
  title: string;
  slug: string;
  status: RaceStatus;
  raceType?: string;
  province?: string;
  location?: string;
  organizer?: string;
  startDate?: string;
  endDate?: string;
  description?: string;
  season?: string;
  imageUrl?: string;
  logoUrl?: string;
  bannerUrl?: string;
  brandColor?: string;
  sponsorBanners?: string[];
  enableEcert?: boolean;
  enableClaim?: boolean;
  enableLiveTracking?: boolean;
  enable5pix?: boolean;
  pixEventUrl?: string;
  cacheTtlSeconds?: number;
  enableHideStats?: boolean;
  enablePrivateList?: boolean;
  privateListLimit?: number;
  courses?: Course[];
  statusHistory?: StatusHistoryEntry[];
}

export interface RaceSponsor {
  _id: string;
  name: string;
  logoUrl: string;
  website?: string;
  level: string;
  order: number;
  raceId?: string;
}

/**
 * Edit-form mirrors `editForm` state of legacy page (BR-AF-23 same field
 * keys). Used to compose payload for `racesControllerUpdateRace`.
 */
export type EditForm = {
  title?: string;
  slug?: string;
  status?: RaceStatus;
  raceType?: string;
  province?: string;
  location?: string;
  organizer?: string;
  startDate?: string;
  endDate?: string;
  description?: string;
  season?: string;
  imageUrl?: string;
  logoUrl?: string;
  bannerUrl?: string;
  brandColor?: string;
  sponsorBanners?: string[];
  enableEcert?: boolean;
  enableClaim?: boolean;
  enableLiveTracking?: boolean;
  enable5pix?: boolean;
  pixEventUrl?: string;
  cacheTtlSeconds?: number;
  enableHideStats?: boolean;
  enablePrivateList?: boolean;
  privateListLimit?: number;
};

/** Section-id constants — used by SettingsLayout nav + URL hash deep-link. */
export const SECTION_IDS = {
  raceMeta: 'race-meta',
  course: 'course',
  timing: 'timing',
  publishing: 'publishing',
  integrations: 'integrations',
  advanced: 'advanced',
} as const;

export type SectionId = (typeof SECTION_IDS)[keyof typeof SECTION_IDS];
