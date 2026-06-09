import { describe, expect, it } from "vitest";
import { getOddsChangePct, isWithinOddsTolerance } from "@/domain/odds";

describe("odds", () => {
  it("calculates odds change percentage", () => {
    expect(getOddsChangePct(2, 1.9)).toBeCloseTo(0.05);
  });

  it("passes below the 6 percent tolerance", () => {
    expect(isWithinOddsTolerance(2, 1.880002)).toBe(true);
  });

  it("blocks at exactly 6 percent", () => {
    expect(isWithinOddsTolerance(2, 1.88)).toBe(false);
  });
});
