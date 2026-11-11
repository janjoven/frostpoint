import { describe, expect, it } from "vitest";
import { GPS_INTERVAL_MS, shouldSend } from "./gps";

describe("shouldSend", () => {
  it("sends the first fix straight away", () => {
    expect(shouldSend(0, Date.now(), 12)).toBe(true);
  });
  it("waits for the interval between updates", () => {
    expect(shouldSend(1000, 1000 + GPS_INTERVAL_MS - 1, 12)).toBe(false);
    expect(shouldSend(1000, 1000 + GPS_INTERVAL_MS, 12)).toBe(true);
  });
  it("skips poor fixes", () => {
    expect(shouldSend(0, Date.now(), 800)).toBe(false);
    expect(shouldSend(0, Date.now(), null)).toBe(true);
  });
});
