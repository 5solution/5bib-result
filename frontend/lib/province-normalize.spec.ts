import {
  normalizeProvince,
  getCityDisplayName,
  isValidCitySlug,
  getAllKnownCitySlugs,
} from "./province-normalize";

describe("normalizeProvince", () => {
  it.each([
    ["TP HCM", "ho-chi-minh"],
    ["TP.HCM", "ho-chi-minh"],
    ["Tp Hồ Chí Minh", "ho-chi-minh"],
    ["Thành phố Hồ Chí Minh", "ho-chi-minh"],
    ["HCM", "ho-chi-minh"],
    ["Sài Gòn", "ho-chi-minh"],
    ["Hà Nội", "ha-noi"],
    ["TP Hà Nội", "ha-noi"],
    ["Đà Nẵng", "da-nang"],
    ["Đà Lạt", "da-lat"],
    ["Lâm Đồng", "da-lat"],
    ["Nha Trang", "nha-trang"],
    ["Khánh Hoà", "nha-trang"],
    ["Hải Phòng", "hai-phong"],
    ["Huế", "hue"],
    ["Thừa Thiên Huế", "hue"],
    ["Cần Thơ", "can-tho"],
    ["Vũng Tàu", "vung-tau"],
    ["Quy Nhơn", "quy-nhon"],
    ["Bình Định", "quy-nhon"],
  ])("normalizes '%s' → '%s'", (input, expected) => {
    expect(normalizeProvince(input)).toBe(expected);
  });

  it("is case-insensitive", () => {
    expect(normalizeProvince("hcm")).toBe("ho-chi-minh");
    expect(normalizeProvince("HÀ NỘI")).toBe("ha-noi");
  });

  it("returns 'khac' for unknown province (BR-22)", () => {
    expect(normalizeProvince("Đồng Nai")).toBe("khac");
    expect(normalizeProvince("Hải Dương")).toBe("khac");
  });

  it("returns null for null/empty (BR-23)", () => {
    expect(normalizeProvince(null)).toBeNull();
    expect(normalizeProvince(undefined)).toBeNull();
    expect(normalizeProvince("")).toBeNull();
    expect(normalizeProvince("   ")).toBeNull();
  });
});

describe("getCityDisplayName", () => {
  it("returns Vietnamese display name", () => {
    expect(getCityDisplayName("ho-chi-minh")).toBe("Hồ Chí Minh");
    expect(getCityDisplayName("da-lat")).toBe("Đà Lạt");
  });

  it("returns 'Khác' for khac slug", () => {
    expect(getCityDisplayName("khac")).toBe("Khác");
  });

  it("returns null for unknown slug", () => {
    expect(getCityDisplayName("invalid")).toBeNull();
  });
});

describe("isValidCitySlug", () => {
  it("accepts 10 known cities + khac", () => {
    expect(isValidCitySlug("ho-chi-minh")).toBe(true);
    expect(isValidCitySlug("khac")).toBe(true);
  });

  it("rejects unknown slug", () => {
    expect(isValidCitySlug("invalid-city")).toBe(false);
  });

  it("getAllKnownCitySlugs returns 10 cities (excludes khac)", () => {
    const all = getAllKnownCitySlugs();
    expect(all.length).toBe(10);
    expect(all).not.toContain("khac");
  });
});
