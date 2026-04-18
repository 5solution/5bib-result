/**
 * Preset list of Vietnamese banks (as of 2026) — canonical source used by
 * backend registration validation.
 *
 * Duplicated verbatim in `crew/lib/banks.ts` and `admin/src/lib/banks.ts`
 * to avoid cross-repo imports. Keep all three in sync.
 */
export const VN_BANKS: readonly string[] = [
  'Vietcombank (VCB)',
  'VietinBank (CTG)',
  'BIDV',
  'Agribank',
  'Techcombank (TCB)',
  'MB Bank (MBB)',
  'ACB',
  'VPBank',
  'Sacombank (STB)',
  'SHB',
  'HDBank',
  'TPBank',
  'OCB',
  'VIB',
  'MSB',
  'SeABank',
  'Eximbank',
  'LienVietPostBank (LPB)',
  'Bac A Bank',
  'DongA Bank',
  'OceanBank',
  'SCB',
  'Viet Capital Bank',
  'PVcomBank',
  'Nam A Bank',
  'Kienlongbank',
  'VietBank',
  'NCB',
  'ABBank',
  'Saigonbank',
  'CBBank',
  'BaoViet Bank',
  'GPBank',
  'Standard Chartered',
  'HSBC Vietnam',
  'UOB Vietnam',
  'Shinhan Bank',
  'Woori Bank',
  'Cake by VPBank',
  'Timo Plus (Bản Việt)',
  'Ubank by VPBank',
  'Khác',
] as const;

export type VnBank = (typeof VN_BANKS)[number];

/**
 * Strip Vietnamese diacritics, uppercase, trim — for holder-name vs.
 * registration full_name comparison. "Nguyễn Văn Á" → "NGUYEN VAN A".
 */
export function normalizeHolderName(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toUpperCase()
    .trim()
    .replace(/\s+/g, ' ');
}
