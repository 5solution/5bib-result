import type { SKRSContext2D, Image } from '@napi-rs/canvas';
import type {
  TemplateKey,
  SizeKey,
  GradientKey,
  TextColorMode,
} from '../dto/result-image-query.dto';

export type BadgeType =
  | 'PB'
  | 'PODIUM'
  | 'AG_PODIUM'
  | 'SUB3H'
  | 'SUB3_30H'
  | 'SUB4H'
  | 'SUB90M'
  | 'SUB_1_45H'
  | 'SUB2H'
  | 'SUB45M'
  | 'SUB_1H'
  | 'SUB20M'
  | 'SUB25M'
  | 'FIRST_RACE'
  | 'ULTRA'
  | 'STREAK';

export interface Badge {
  type: BadgeType;
  label: string; // "🏆 Personal Best"
  shortLabel: string; // "PB"
  /** Hex color for badge background */
  color: string;
  /** Optional icon path (asset file). If null → use emoji in label */
  iconPath?: string;
  /** Optional metadata (e.g., PB delta) */
  meta?: Record<string, string | number>;
}

export interface SplitData {
  name: string;
  time: string;
  pace?: string;
}

/** Data passed to every template's render() function. */
export interface RenderData {
  // Athlete result
  athleteName: string;
  bib: string;
  chipTime: string;
  gunTime: string;
  pace: string;
  overallRank: string;
  totalFinishers: number;
  genderRank: string;
  categoryRank: string;
  category: string;
  gender: string;
  gap: string;
  distance: string;

  // Race
  raceName: string;
  raceSlug: string;
  raceDate?: string;
  courseName?: string;

  // Optional
  splits?: SplitData[];
  badges?: Badge[];
  customMessage?: string;

  // Computed
  resultUrl: string; // result.5bib.com/races/[slug]/[bib]
  textColorScheme: 'light' | 'dark';

  // Template + sizing
  template: TemplateKey;
  size: SizeKey;
  canvasWidth: number;
  canvasHeight: number;
  preview: boolean; // true → 480px low-res

  // Background
  gradientPreset: GradientKey;
  customPhoto?: Image;
  qrImage?: Image; // pre-rendered QR code PNG if showQrCode=true

  // Loaded assets
  assets: {
    logo5BIB: Image | null;
    fontFamily: string; // "Be Vietnam Pro"
    monoFontFamily: string; // "Inter"
  };

  // User toggles
  showSplits: boolean;
  showQrCode: boolean;
  showBadges: boolean;
  textColorMode: TextColorMode;
}

export interface TemplateConfig {
  name: TemplateKey;
  /** Supported sizes. `story` = 9:16 only, others = all 3. */
  sizes: readonly SizeKey[];
  /**
   * If present, template is locked unless this condition is met.
   * Returns true when the template IS allowed for this athlete.
   */
  eligible?: (data: RenderData) => boolean;
  /** The actual canvas render function. Must fill the entire canvas. */
  render: (ctx: SKRSContext2D, data: RenderData) => Promise<void>;
}

/** Canvas dimensions per size. Full-res rendering. */
export const SIZE_DIMENSIONS: Record<SizeKey, { width: number; height: number }> = {
  '4:5': { width: 1080, height: 1350 },
  '1:1': { width: 1080, height: 1080 },
  '9:16': { width: 1080, height: 1920 },
};

/** Preview dimensions — ~half the full size for faster render. */
export const PREVIEW_DIMENSIONS: Record<SizeKey, { width: number; height: number }> = {
  '4:5': { width: 480, height: 600 },
  '1:1': { width: 480, height: 480 },
  '9:16': { width: 480, height: 854 },
};

export const GRADIENT_STOPS: Record<GradientKey, Array<[number, string]>> = {
  blue: [
    [0, '#2563eb'],
    [0.5, '#1e40af'],
    [1, '#3730a3'],
  ],
  dark: [
    [0, '#0f172a'],
    [0.5, '#1e293b'],
    [1, '#334155'],
  ],
  sunset: [
    [0, '#f97316'],
    [0.5, '#dc2626'],
    [1, '#be123c'],
  ],
  forest: [
    [0, '#059669'],
    [0.5, '#047857'],
    [1, '#065f46'],
  ],
  purple: [
    [0, '#7c3aed'],
    [0.5, '#6d28d9'],
    [1, '#4c1d95'],
  ],
};
