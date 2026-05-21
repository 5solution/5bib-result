/**
 * Vietnamese province / city name normalization.
 *
 * Vendor data trong races collection có nhiều dạng:
 *   - "Hà Nội" / "Thành phố Hà Nội" / "TP Hà Nội"
 *   - "Đồng Nai" / "Tỉnh Đồng Nai"
 *   - "Lâm Đồng " (trailing space) / "Tỉnh Lâm Đồng"
 *   - "Hải Phòng" / "Tp Hải Phòng" / "Thành phố Hải Phòng"
 *
 * Mục tiêu: convert tất cả về 1 canonical display name (no "Tỉnh"/"Thành phố"
 * prefix, no trailing space). Dùng cho geographic badge dedup ở
 * `AthleteProfileService.computeProvinces()`.
 *
 * Mirror frontend `lib/province-normalize.ts` ở structural level — nhưng
 * mục đích KHÁC: frontend = city-slug bucketing cho SEO; backend = canonical
 * display string for dedup. Cả hai dùng được cho mục đích riêng.
 */

/**
 * Strip common Vietnamese prefixes + collapse whitespace.
 * Returns null nếu input rỗng / undefined.
 *
 * Examples:
 *   - "Tỉnh Đồng Nai"        → "Đồng Nai"
 *   - "Thành phố Hà Nội"     → "Hà Nội"
 *   - "Tp Hải Phòng"         → "Hải Phòng"
 *   - "TP. Hồ Chí Minh"      → "Hồ Chí Minh"
 *   - "Lâm Đồng "            → "Lâm Đồng"
 *   - "Ba Bể - Thái Nguyên"  → "Thái Nguyên"   (split on `-`, take RHS)
 *   - "Phường X - Y - Z"     → "Z"             (take last segment)
 */
export function normalizeProvinceDisplay(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let s = raw.trim();
  if (!s) return null;

  // Step 1: if hyphen-separated (e.g. "Ba Bể - Thái Nguyên" / "Phường X - Tỉnh Y"),
  // take the LAST segment — usually the actual province name.
  if (s.includes('-')) {
    const parts = s
      .split('-')
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length > 1) s = parts[parts.length - 1];
  }

  // Step 2: strip common administrative prefixes (case-insensitive, with optional dot/space)
  //   - "Tỉnh "        (province prefix)
  //   - "Thành phố "   (city prefix full form)
  //   - "TP. " / "TP " / "Tp " (city prefix abbrev)
  //   - "Phường "      (ward — rare in race data but caught)
  s = s.replace(
    /^(tỉnh|thành phố|tp\.?|t\.p\.?|phường|quận|huyện|thị xã|thị trấn)\s+/i,
    '',
  );

  // Step 3: collapse internal whitespace
  s = s.replace(/\s+/g, ' ').trim();

  return s || null;
}

/**
 * Normalize + canonicalize via alias map (handles edge cases like
 * "Hồ Chí Minh" vs "TPHCM" vs "Sài Gòn" — all → "Hồ Chí Minh").
 *
 * Falls back to normalizeProvinceDisplay() output if no alias match.
 */
const PROVINCE_ALIASES: Record<string, string> = {
  hcm: 'Hồ Chí Minh',
  tphcm: 'Hồ Chí Minh',
  'sài gòn': 'Hồ Chí Minh',
  saigon: 'Hồ Chí Minh',
  'hà nội': 'Hà Nội',
  'ha noi': 'Hà Nội',
  hn: 'Hà Nội',
  'đà nẵng': 'Đà Nẵng',
  'da nang': 'Đà Nẵng',
  'hải phòng': 'Hải Phòng',
  'hai phong': 'Hải Phòng',
  huế: 'Huế',
  hue: 'Huế',
  'thừa thiên huế': 'Huế',
  'cần thơ': 'Cần Thơ',
  'can tho': 'Cần Thơ',
  'đà lạt': 'Lâm Đồng',
  'da lat': 'Lâm Đồng',
  'lâm đồng': 'Lâm Đồng',
  'nha trang': 'Khánh Hòa',
  'khánh hoà': 'Khánh Hòa',
  'khánh hòa': 'Khánh Hòa',
};

export function canonicalizeProvince(raw: string | null | undefined): string | null {
  const stripped = normalizeProvinceDisplay(raw);
  if (!stripped) return null;
  const aliasKey = stripped.toLowerCase();
  return PROVINCE_ALIASES[aliasKey] ?? stripped;
}
