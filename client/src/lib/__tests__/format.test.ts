import { describe, expect, it } from "vitest";

import { formatDate, formatKRW, formatKRWShort, formatSpecValue, researchLinkToRoute } from "../format";

describe("format", () => {
  it("formats won", () => {
    expect(formatKRW(1250000)).toBe("1,250,000원");
    expect(formatKRWShort(990000)).toBe("99만원");
    expect(formatKRWShort(1234500)).toBe("123만 4,500원");
  });

  it("formats dates without timezone shifts for plain dates", () => {
    expect(formatDate("2026-10-21")).toBe("2026.10.21");
    expect(formatDate(null)).toBe("날짜 없음");
  });

  it("renders free-form spec values", () => {
    expect(formatSpecValue([1500, 2000], "mm")).toBe("1500 × 2000 mm");
    expect(formatSpecValue({ Q: "1500 x 2000" }, null)).toBe("Q: 1500 x 2000");
    expect(formatSpecValue(null, null)).toBe("미확인");
    expect(formatSpecValue(280, "mm")).toBe("280 mm");
  });

  it("maps research cross-links to app routes", () => {
    expect(researchLinkToRoute("../models/simmons-jasmine.md")).toBe("/models/simmons-jasmine");
    expect(researchLinkToRoute("../brands/ace.md")).toBe("/brands/ace");
    expect(researchLinkToRoute("../categories/beds.md")).toBe("/research/beds");
    expect(researchLinkToRoute("https://example.com/a.md")).toBeNull();
  });
});
