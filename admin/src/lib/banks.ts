/**
 * Preset list of Vietnamese banks (as of 2026) — canonical source used on the
 * admin manual-register dialog AND the crew register form.
 *
 * Duplicated verbatim in `crew/lib/banks.ts` and
 * `backend/src/modules/team-management/constants/banks.ts` to avoid
 * cross-repo imports. Keep all three in sync.
 */
export const VN_BANKS: readonly string[] = [
  "Vietcombank (VCB)",
  "VietinBank (CTG)",
  "BIDV",
  "Agribank",
  "Techcombank (TCB)",
  "MB Bank (MBB)",
  "ACB",
  "VPBank",
  "Sacombank (STB)",
  "SHB",
  "HDBank",
  "TPBank",
  "OCB",
  "VIB",
  "MSB",
  "SeABank",
  "Eximbank",
  "LienVietPostBank (LPB)",
  "Bac A Bank",
  "DongA Bank",
  "OceanBank",
  "SCB",
  "Viet Capital Bank",
  "PVcomBank",
  "Nam A Bank",
  "Kienlongbank",
  "VietBank",
  "NCB",
  "ABBank",
  "Saigonbank",
  "CBBank",
  "BaoViet Bank",
  "GPBank",
  "Standard Chartered",
  "HSBC Vietnam",
  "UOB Vietnam",
  "Shinhan Bank",
  "Woori Bank",
  "Cake by VPBank",
  "Timo Plus (Bản Việt)",
  "Ubank by VPBank",
  "Khác",
] as const;
