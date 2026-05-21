/**
 * FEATURE-056 — City derivation chain helper (Manager Clarification #1).
 *
 * Resolution order per BR-56-04 (corrected — `race_athletes.nationality` does NOT
 * exist; field actually exists in `race_results.nationality`):
 *
 *   1. `race_results.nationality` (vendor field) → canonicalizeProvince()
 *   2. `race_results.club` regex extract province from "Hanoi Runners Club" → "Hà Nội"
 *   3. (caller-supplied) `race_athletes.subinfo.club` join → same regex extract
 *   4. null → frontend hides city chip
 *
 * DATA INTEGRITY (Danny "k nó kiện đấy" mandate):
 * - NEVER guess city — defamation risk if wrong association ("X từ Y" wrong city).
 * - Vietnamese-province whitelist match REQUIRED. "5BIB Crew" → null (no match).
 * - Output max 80 chars (DTO mandate BR-56-21 + safety).
 */
import { canonicalizeProvince } from '../../../common/utils/province-normalize';

/**
 * Whitelist of canonical Vietnamese province display names (post-canonicalize).
 * Used to verify free-text club strings actually contain a province token
 * before claiming derived city.
 */
const VN_PROVINCES_CANONICAL: readonly string[] = [
  'Hà Nội',
  'Hồ Chí Minh',
  'Đà Nẵng',
  'Hải Phòng',
  'Cần Thơ',
  'Huế',
  'Khánh Hòa',
  'Lâm Đồng',
  'An Giang',
  'Bà Rịa - Vũng Tàu',
  'Bắc Giang',
  'Bắc Kạn',
  'Bạc Liêu',
  'Bắc Ninh',
  'Bến Tre',
  'Bình Dương',
  'Bình Định',
  'Bình Phước',
  'Bình Thuận',
  'Cà Mau',
  'Cao Bằng',
  'Đắk Lắk',
  'Đắk Nông',
  'Điện Biên',
  'Đồng Nai',
  'Đồng Tháp',
  'Gia Lai',
  'Hà Giang',
  'Hà Nam',
  'Hà Tĩnh',
  'Hải Dương',
  'Hậu Giang',
  'Hòa Bình',
  'Hưng Yên',
  'Kiên Giang',
  'Kon Tum',
  'Lai Châu',
  'Lạng Sơn',
  'Lào Cai',
  'Long An',
  'Nam Định',
  'Nghệ An',
  'Ninh Bình',
  'Ninh Thuận',
  'Phú Thọ',
  'Phú Yên',
  'Quảng Bình',
  'Quảng Nam',
  'Quảng Ngãi',
  'Quảng Ninh',
  'Quảng Trị',
  'Sóc Trăng',
  'Sơn La',
  'Tây Ninh',
  'Thái Bình',
  'Thái Nguyên',
  'Thanh Hóa',
  'Tiền Giang',
  'Trà Vinh',
  'Tuyên Quang',
  'Vĩnh Long',
  'Vĩnh Phúc',
  'Yên Bái',
];

/**
 * Diacritic-fold helper for case+accent-insensitive matching.
 * Vietnamese "Hà Nội" / "Ha Noi" / "ha noi" all collapse to "ha noi".
 */
function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .trim();
}

/**
 * Unaccented alias map → canonical. Vendor data often has "Hanoi" / "Saigon" /
 * "Da Nang" without diacritics. Map to canonical display.
 */
const UNACCENTED_ALIASES: Record<string, string> = {
  hanoi: 'Hà Nội',
  hochiminh: 'Hồ Chí Minh',
  saigon: 'Hồ Chí Minh',
  tphcm: 'Hồ Chí Minh',
  hcm: 'Hồ Chí Minh',
  danang: 'Đà Nẵng',
  haiphong: 'Hải Phòng',
  cantho: 'Cần Thơ',
  nhatrang: 'Khánh Hòa',
  dalat: 'Lâm Đồng',
  hagiang: 'Hà Giang',
  laocai: 'Lào Cai',
};

const FOLDED_PROVINCE_LOOKUP: ReadonlyMap<string, string> = new Map([
  ...VN_PROVINCES_CANONICAL.map((p): [string, string] => [fold(p), p]),
  ...Object.entries(UNACCENTED_ALIASES),
]);

/**
 * Try to extract a canonical province from a free-text string (club name,
 * description, etc.). Returns canonical display string or null.
 *
 * Strategy:
 *  1. canonicalizeProvince() — handles "Tỉnh / Thành phố / TP" prefixes.
 *  2. If canonical match in whitelist → return.
 *  3. Else: substring-scan club text for any province token (folded match).
 *
 * DATA INTEGRITY: substring scan uses folded form to avoid false negatives
 * on "Hanoi" / "Saigon" etc. Whitelist match ensures NO false positives like
 * "5BIB Crew" → "5BIB".
 */
export function extractCityFromText(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Step 1: try canonicalize as if it IS a province name.
  const canon = canonicalizeProvince(trimmed);
  if (canon && FOLDED_PROVINCE_LOOKUP.has(fold(canon))) {
    return canon;
  }

  // Step 2: substring scan — look for any province token in the folded text.
  const folded = fold(trimmed);
  for (const [foldedKey, canonical] of FOLDED_PROVINCE_LOOKUP) {
    // Word-ish boundary: prevent "hai" matching inside "shanghai". Use simple
    // start-of-token + end-of-token heuristic (space, hyphen, or string edge).
    const re = new RegExp(`(^|[\\s\\-,/])${escapeRegExp(foldedKey)}([\\s\\-,/]|$)`);
    if (re.test(folded)) return canonical;
  }
  return null;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export interface CityDeriveInput {
  /** race_results.nationality (vendor field — may contain province name) */
  nationality?: string | null;
  /** race_results.club (vendor field — may contain province inside club name) */
  club?: string | null;
  /** Optional: race_athletes.subinfo.club joined upstream (Phase 3 chain). */
  subinfoClub?: string | null;
}

/**
 * Run full derivation chain. Returns canonical city or null.
 * Output truncated to 80 chars (BR-56-21 + DTO maxLength).
 */
export function deriveCity(input: CityDeriveInput): string | null {
  const fromNationality = extractCityFromText(input.nationality);
  if (fromNationality) return truncate(fromNationality, 80);

  const fromClub = extractCityFromText(input.club);
  if (fromClub) return truncate(fromClub, 80);

  const fromSubinfo = extractCityFromText(input.subinfoClub);
  if (fromSubinfo) return truncate(fromSubinfo, 80);

  return null;
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}
