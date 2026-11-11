import { describe, expect, it } from "vitest";
import { ago, distText, etaText } from "./track";

describe("track helpers", () => {
  const now = Date.parse("2026-10-20T10:00:00Z");
  it("describes how fresh a location is", () => {
    expect(ago("2026-10-20T09:59:52Z", now)).toBe("8 s ago");
    expect(ago("2026-10-20T09:57:00Z", now)).toBe("3 min ago");
    expect(ago("2026-10-20T08:00:00Z", now)).toBe("2 h ago");
  });
  it("words the ETA", () => {
    expect(etaText(1)).toBe("less than a minute");
    expect(etaText(12)).toBe("about 12 min");
    expect(etaText(75)).toBe("about 1 h 15 min");
  });
  it("formats distance", () => {
    expect(distText(840)).toBe("840 m");
    expect(distText(2430)).toBe("2.4 km");
  });
});
