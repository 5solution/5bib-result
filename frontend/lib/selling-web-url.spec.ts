import { buildSellingWebUrl } from "./selling-web-url";

describe("buildSellingWebUrl", () => {
  it("builds URL with slug + raceId (happy path)", () => {
    const url = buildSellingWebUrl("vnexpress-marathon-hcm-2026", "abc123");
    expect(url).toContain("https://5bib.com/vi/events/vnexpress-marathon-hcm-2026_abc123");
    expect(url).toContain("ref=seo-giai-chay");
    expect(url).toContain("utm_source=organic");
    expect(url).toContain("utm_medium=seo");
    expect(url).toContain("utm_campaign=giai-chay");
  });

  it("falls back to raceId only when slug is null (BR-13)", () => {
    const url = buildSellingWebUrl(null, "abc123");
    expect(url).toContain("/vi/events/abc123?");
    expect(url).not.toContain("_abc123");
  });

  it("falls back to raceId only when slug is undefined", () => {
    const url = buildSellingWebUrl(undefined, "race-id");
    expect(url).toContain("/vi/events/race-id?");
  });

  it("falls back to raceId only when slug is empty string", () => {
    const url = buildSellingWebUrl("", "race-id");
    expect(url).toContain("/vi/events/race-id?");
  });

  it("URL-encodes slug with special chars", () => {
    const url = buildSellingWebUrl("hello world", "abc");
    expect(url).toContain("hello%20world");
  });

  it("always includes all 4 UTM params + ref", () => {
    const url = buildSellingWebUrl("any", "any");
    const params = new URL(url).searchParams;
    expect(params.get("ref")).toBe("seo-giai-chay");
    expect(params.get("utm_source")).toBe("organic");
    expect(params.get("utm_medium")).toBe("seo");
    expect(params.get("utm_campaign")).toBe("giai-chay");
  });
});
