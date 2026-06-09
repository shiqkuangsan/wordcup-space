import { describe, expect, it } from "vitest";
import { formatCny, getPotentialReturnCents, toCents } from "@/domain/money";

describe("money", () => {
  it("converts yuan to cents", () => {
    expect(toCents(1000)).toBe(100000);
    expect(toCents(12.34)).toBe(1234);
  });

  it("formats cents as fixed yuan", () => {
    expect(formatCny(123456)).toBe("1234.56");
  });

  it("calculates potential return", () => {
    expect(getPotentialReturnCents(10000, 2.35)).toBe(23500);
  });
});
