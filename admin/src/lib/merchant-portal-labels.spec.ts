/**
 * F-069 M3 — Unit test cho merchant-portal-labels (pure functions, no RTL).
 * Chạy qua jest.kiosk.config.cjs (ts-jest, node env).
 */
import {
  MP_PERMISSION_LABEL,
  formatPermission,
  formatPermissionTier,
  formatMerchantStatus,
  statusKeyFromActive,
  formatRaceCount,
} from "./merchant-portal-labels";

describe("merchant-portal-labels", () => {
  describe("formatPermission", () => {
    it("maps ticket_report → VN", () => {
      expect(formatPermission("ticket_report")).toBe("Báo cáo vé");
    });
    it("maps revenue_report → VN", () => {
      expect(formatPermission("revenue_report")).toBe("Báo cáo doanh thu");
    });
    it("falls back to raw value for unknown key (dev visibility)", () => {
      expect(formatPermission("unknown_perm")).toBe("unknown_perm");
    });
    it("returns dash for null/undefined", () => {
      expect(formatPermission(null)).toBe("—");
      expect(formatPermission(undefined)).toBe("—");
    });
    it("dictionary covers both enum values", () => {
      expect(Object.keys(MP_PERMISSION_LABEL).sort()).toEqual([
        "revenue_report",
        "ticket_report",
      ]);
    });
  });

  describe("formatPermissionTier", () => {
    it("maps ticket_only / ticket_and_revenue", () => {
      expect(formatPermissionTier("ticket_only")).toBe("Chỉ báo cáo vé");
      expect(formatPermissionTier("ticket_and_revenue")).toBe("Vé + Doanh thu");
    });
    it("dash for empty", () => {
      expect(formatPermissionTier("")).toBe("—");
    });
  });

  describe("formatMerchantStatus + statusKeyFromActive", () => {
    it("active true → key active → VN", () => {
      expect(statusKeyFromActive(true)).toBe("active");
      expect(formatMerchantStatus("active")).toBe("Đang hoạt động");
    });
    it("active false → key inactive → VN", () => {
      expect(statusKeyFromActive(false)).toBe("inactive");
      expect(formatMerchantStatus("inactive")).toBe("Đã khóa");
    });
  });

  describe("formatRaceCount", () => {
    it("'__all' sentinel → 'Tất cả giải'", () => {
      expect(formatRaceCount("__all")).toBe("Tất cả giải");
    });
    it("number → 'N giải'", () => {
      expect(formatRaceCount(3)).toBe("3 giải");
      expect(formatRaceCount(0)).toBe("0 giải");
    });
    it("numeric string → 'N giải'", () => {
      expect(formatRaceCount("5")).toBe("5 giải");
    });
    it("non-numeric / object / null → dash", () => {
      expect(formatRaceCount("abc")).toBe("—");
      expect(formatRaceCount({})).toBe("—");
      expect(formatRaceCount(null)).toBe("—");
      expect(formatRaceCount(undefined)).toBe("—");
    });
  });
});
