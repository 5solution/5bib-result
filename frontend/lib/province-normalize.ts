/**
 * FEATURE-036 — Province name normalization (BR-21~23).
 *
 * Vendor data không đồng nhất ("Tp Hồ Chí Minh" / "TP.HCM" / "HCM" → same).
 * Map alias → kebab-case city slug. Top 10 cities có race.
 *
 * Race với province KHÔNG khớp → fallback `khac` bucket (low SEO value,
 * KHÔNG xuất hiện trong sitemap per BR-22).
 *
 * Race với province null/empty → KHÔNG hiển thị trên ANY city page (BR-23),
 * normalizeProvince returns null.
 */

type CitySlug =
  | "ho-chi-minh"
  | "ha-noi"
  | "da-nang"
  | "da-lat"
  | "nha-trang"
  | "hai-phong"
  | "hue"
  | "can-tho"
  | "vung-tau"
  | "quy-nhon"
  | "khac";

interface CityEntry {
  slug: CitySlug;
  displayName: string;
  aliases: string[];
}

export const CITY_REGISTRY: CityEntry[] = [
  {
    slug: "ho-chi-minh",
    displayName: "Hồ Chí Minh",
    aliases: [
      "TP HCM",
      "TP.HCM",
      "Tp Hồ Chí Minh",
      "Thành phố Hồ Chí Minh",
      "HCM",
      "Hồ Chí Minh",
      "tphcm",
      "Sài Gòn",
      "Saigon",
    ],
  },
  {
    slug: "ha-noi",
    displayName: "Hà Nội",
    aliases: ["Hà Nội", "Ha Noi", "TP Hà Nội", "Thành phố Hà Nội", "HN"],
  },
  {
    slug: "da-nang",
    displayName: "Đà Nẵng",
    aliases: ["Đà Nẵng", "Da Nang", "TP Đà Nẵng"],
  },
  {
    slug: "da-lat",
    displayName: "Đà Lạt",
    aliases: ["Đà Lạt", "Da Lat", "Lâm Đồng", "Lam Dong"],
  },
  {
    slug: "nha-trang",
    displayName: "Nha Trang",
    aliases: ["Nha Trang", "Khánh Hoà", "Khánh Hòa", "Khanh Hoa"],
  },
  {
    slug: "hai-phong",
    displayName: "Hải Phòng",
    aliases: ["Hải Phòng", "Hai Phong", "TP Hải Phòng"],
  },
  {
    slug: "hue",
    displayName: "Huế",
    aliases: ["Huế", "Hue", "Thừa Thiên Huế", "TT Huế", "Thua Thien Hue"],
  },
  {
    slug: "can-tho",
    displayName: "Cần Thơ",
    aliases: ["Cần Thơ", "Can Tho", "TP Cần Thơ"],
  },
  {
    slug: "vung-tau",
    displayName: "Vũng Tàu",
    aliases: ["Vũng Tàu", "Vung Tau", "Bà Rịa Vũng Tàu", "BRVT", "Ba Ria Vung Tau"],
  },
  {
    slug: "quy-nhon",
    displayName: "Quy Nhơn",
    aliases: ["Quy Nhơn", "Quy Nhon", "Bình Định", "Binh Dinh"],
  },
];

const KNOWN_SLUGS: CitySlug[] = [
  "ho-chi-minh",
  "ha-noi",
  "da-nang",
  "da-lat",
  "nha-trang",
  "hai-phong",
  "hue",
  "can-tho",
  "vung-tau",
  "quy-nhon",
  "khac",
];

/**
 * BR-23: returns null when province is null/empty.
 * BR-22: returns 'khac' when province doesn't match any alias.
 */
export function normalizeProvince(
  raw: string | null | undefined,
): CitySlug | null {
  if (!raw || raw.trim() === "") return null;
  const normalized = raw.trim().toLowerCase();
  for (const city of CITY_REGISTRY) {
    if (city.aliases.some((a) => a.toLowerCase() === normalized)) {
      return city.slug;
    }
  }
  return "khac";
}

export function getCityDisplayName(slug: string): string | null {
  if (slug === "khac") return "Khác";
  const entry = CITY_REGISTRY.find((c) => c.slug === slug);
  return entry?.displayName ?? null;
}

export function isValidCitySlug(slug: string): slug is CitySlug {
  return KNOWN_SLUGS.includes(slug as CitySlug);
}

export function getAllKnownCitySlugs(): CitySlug[] {
  return CITY_REGISTRY.map((c) => c.slug);
}
