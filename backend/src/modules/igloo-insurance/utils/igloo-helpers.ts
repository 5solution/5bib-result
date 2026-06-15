/**
 * FEATURE-085 — Igloo Insurance pure helpers.
 *
 * Tách riêng pure functions (KHÔNG phụ thuộc DB / Nest DI) để unit-test
 * nhanh + cô lập logic tiền/eligibility/payload. Mọi quyết định nghiệp vụ
 * (BR-IGL-*) encode ở đây.
 *
 * Danny chốt 2026-06-15 (AUTHORITATIVE OVERRIDES):
 *   - Phí CỐ ĐỊNH 10.000đ/đơn. packageCode = ROAD luôn. Coverage 1 ngày.
 *   - KHÔNG mask PII. KHÔNG lấy VĐV nước ngoài (id_number 9–12 chữ số).
 *   - gender chỉ MALE/FEMALE. CCCD nhận 9 (CMND) và 12 số.
 */

/** Phí cố định mỗi đơn (VNĐ) — BR-IGL-08 OVERRIDES. */
export const IGLOO_PREMIUM_FLAT = 10000;

/** packageCode ép cứng ROAD để đạt phí 10k/ngày — BR-IGL-08 OVERRIDES. */
export const IGLOO_PACKAGE_CODE = 'ROAD' as const;

/** relationCode mặc định — requester = insured (chính chủ). */
export const IGLOO_RELATION_INSURED = 'INSURED' as const;

/**
 * Hàng raw đọc từ legacy MySQL (`athletes` a JOIN `athlete_subinfo` s JOIN `races` r).
 * Dùng cho cả selection lẫn payload build.
 */
export interface LegacyAthleteRow {
  athletes_id: number;
  name: string | null;
  bib_number: string | null;
  email: string | null;
  dob: Date | string | null;
  created_on: Date | string | null;
  gender: string | null; // subinfo.gender: MALE | FEMALE | OTHER
  contact_phone: string | null; // subinfo.contact_phone
  id_number: string | null; // subinfo.id_number (CCCD/CMND)
  race_id: number;
  race_title: string | null;
  event_start_date: Date | string | null;
  event_end_date: Date | string | null;
  race_type: string | null;
  location: string | null;
  province: string | null;
  district: string | null;
  course_distance?: string | null;
}

/** Payload gửi Igloo `POST /partner/insurance/requests`. */
export interface IglooInsuredPayload {
  name: string;
  dateOfBirth: string; // YYYY-MM-DD
  gender: 'MALE' | 'FEMALE';
  idCard: string;
  email: string;
  phone: string;
  address: string;
}

export interface IglooCoveragePayload {
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
  packageCode: 'ROAD' | 'TRAIL';
  premium: number;
  premiumVat: number;
}

export interface IglooRequesterPayload extends IglooInsuredPayload {
  relationCode: 'INSURED';
}

export interface IglooTournamentPayload {
  name?: string;
  bibNumber?: string;
  distance?: string;
}

export interface CreateIglooRequestPayload {
  partnerRefId: string;
  insured: IglooInsuredPayload;
  coverage: IglooCoveragePayload;
  requester: IglooRequesterPayload;
  tournament?: IglooTournamentPayload;
}

/**
 * Chuẩn hoá số điện thoại VN về dạng `0xxxxxxxxx` (10 số).
 * Hỗ trợ `+84`/`84`/khoảng trắng/dấu chấm/gạch. Trả null nếu không hợp lệ.
 * BR-IGL-18.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let s = String(raw).trim().replace(/[\s.\-()]/g, '');
  if (s.startsWith('+84')) s = '0' + s.slice(3);
  else if (s.startsWith('84') && s.length === 11) s = '0' + s.slice(2);
  return /^0[0-9]{9}$/.test(s) ? s : null;
}

/**
 * CCCD/CMND hợp lệ = 9 hoặc 12 chữ số (BR-IGL-08b). Loại passport/giấy tờ
 * có chữ → đồng thời loại VĐV nước ngoài (BR-IGL OVERRIDES #8).
 */
export function isValidIdCard(raw: string | null | undefined): boolean {
  if (!raw) return false;
  return /^[0-9]{9,12}$/.test(String(raw).trim());
}

/** Chuẩn hoá gender về MALE/FEMALE; OTHER/null → null (BR-IGL-17). */
export function normalizeGender(
  raw: string | null | undefined,
): 'MALE' | 'FEMALE' | null {
  const g = (raw ?? '').trim().toUpperCase();
  if (g === 'MALE') return 'MALE';
  if (g === 'FEMALE') return 'FEMALE';
  return null;
}

/** Format Date | 'YYYY-MM-DD...' → 'YYYY-MM-DD'. */
export function toYmd(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  if (typeof d === 'string') {
    const m = d.match(/^(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : null;
  }
  if (d instanceof Date && !Number.isNaN(d.getTime())) {
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const da = String(d.getDate()).padStart(2, '0');
    return `${y}-${mo}-${da}`;
  }
  return null;
}

/**
 * packageCode — Danny chốt ép ROAD luôn (BR-IGL-08 OVERRIDES). race_type chỉ
 * tham khảo, KHÔNG đổi gói. Giữ param để rõ ý đồ + future-proof.
 */
export function derivePackageCode(_raceType?: string | null): 'ROAD' | 'TRAIL' {
  return IGLOO_PACKAGE_CODE;
}

/**
 * Coverage 1 ngày kể từ ngày bắt đầu giải (BR-IGL-07 OVERRIDES).
 * Trả null nếu event_start_date không parse được (→ loại ở isEligible).
 */
export function computeCoverage(
  eventStartDate: Date | string | null | undefined,
): { from: string; to: string; totalDays: number } | null {
  const from = toYmd(eventStartDate);
  if (!from) return null;
  return { from, to: from, totalDays: 1 };
}

/** Phí cố định 10k (BR-IGL-08 OVERRIDES). premium = premiumVat = totalPayment. */
export function computePremium(): {
  premium: number;
  premiumVat: number;
  totalPayment: number;
} {
  return {
    premium: IGLOO_PREMIUM_FLAT,
    premiumVat: IGLOO_PREMIUM_FLAT,
    totalPayment: IGLOO_PREMIUM_FLAT,
  };
}

/** Idempotency key — 1 VĐV/giải = 1 đơn (BR-IGL-06). */
export function buildPartnerRefId(athletesId: number, raceId: number): string {
  return `igloo:${athletesId}:${raceId}`;
}

/** Ghép địa chỉ từ địa điểm giải (BR-IGL-09). Fallback 'Việt Nam'. */
export function buildAddress(row: LegacyAthleteRow): string {
  const parts = [row.location, row.district, row.province]
    .map((p) => (p ?? '').trim())
    .filter(Boolean);
  return parts.length ? parts.join(', ') : 'Việt Nam';
}

/**
 * VĐV đủ điều kiện tạo đơn (BR-IGL-04). `today` truyền vào để test tất định
 * (tránh new Date() trong pure fn).
 */
export function isEligible(row: LegacyAthleteRow, today: Date): boolean {
  if (!row.name || !row.name.trim()) return false;
  if (!toYmd(row.dob)) return false;
  if (!normalizeGender(row.gender)) return false;
  if (!isValidIdCard(row.id_number)) return false;
  if (!normalizePhone(row.contact_phone)) return false;
  if (!row.email || !row.email.trim()) return false;

  const startYmd = toYmd(row.event_start_date);
  if (!startYmd) return false;
  const todayYmd = toYmd(today);
  // event_start_date >= hôm nay (so sánh chuỗi YYYY-MM-DD an toàn).
  if (todayYmd && startYmd < todayYmd) return false;

  return true;
}

/**
 * Build payload Igloo từ 1 hàng legacy (BR-IGL-09). Gọi SAU khi isEligible=true
 * (các field đã đảm bảo non-null). Throw nếu thiếu field bắt buộc (defensive).
 */
export function buildIglooPayload(row: LegacyAthleteRow): CreateIglooRequestPayload {
  const gender = normalizeGender(row.gender);
  const phone = normalizePhone(row.contact_phone);
  const dob = toYmd(row.dob);
  const coverage = computeCoverage(row.event_start_date);
  if (!gender || !phone || !dob || !coverage || !isValidIdCard(row.id_number)) {
    throw new Error(
      `buildIglooPayload: athlete ${row.athletes_id} thiếu field bắt buộc`,
    );
  }
  const idCard = String(row.id_number).trim();
  const address = buildAddress(row);
  const { premium, premiumVat } = computePremium();

  const insured: IglooInsuredPayload = {
    name: row.name!.trim(),
    dateOfBirth: dob,
    gender,
    idCard,
    email: row.email!.trim(),
    phone,
    address,
  };

  return {
    partnerRefId: buildPartnerRefId(row.athletes_id, row.race_id),
    insured,
    coverage: {
      from: coverage.from,
      to: coverage.to,
      packageCode: derivePackageCode(row.race_type),
      premium,
      premiumVat,
    },
    requester: { ...insured, relationCode: IGLOO_RELATION_INSURED },
    tournament: {
      name: row.race_title?.trim() || undefined,
      bibNumber: row.bib_number?.trim() || undefined,
      distance: row.course_distance?.trim() || undefined,
    },
  };
}
