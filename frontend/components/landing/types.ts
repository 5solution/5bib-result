/**
 * FEATURE-083 — Public landing types (mirror backend PublicLandingResponseDto).
 * Hand-authored (SDK regen happens in admin phase; public renderer needs these now).
 */

export interface LandingRaceRef {
  raceId: string;
  mysqlRaceId?: number | null;
  slug?: string;
}

export interface LandingTheme {
  main: string;
  sec: string;
  fontHeading?: string;
  fontBody?: string;
  heroOverlay?: number;
  preset?: string;
}

export interface LandingMeta {
  title?: string;
  description?: string;
  lang?: string;
  ogImage?: string;
  favicon?: string;
  robots?: string;
  analytics?: { ga4MeasurementId?: string; fbPixelId?: string };
}

export type LandingSectionType =
  | 'hero'
  | 'about'
  | 'course'
  | 'schedule'
  | 'pricing'
  | 'results_embed'
  | 'photos_embed'
  | 'gallery'
  | 'sponsors'
  | 'contact_social';

export interface LandingSection {
  id: string;
  type: LandingSectionType | string;
  variant: string;
  enabled: boolean;
  order: number;
  anchor?: string;
  /** Type-specific config. Sections narrow this to a local typed view. */
  data: Record<string, unknown>;
}

export interface LandingData {
  id: string;
  raceRef: LandingRaceRef;
  meta: LandingMeta;
  theme: LandingTheme;
  subdomain?: string;
  sections: LandingSection[];
}

/** Props every section component receives. */
export interface SectionProps {
  section: LandingSection;
  theme: LandingTheme;
}
