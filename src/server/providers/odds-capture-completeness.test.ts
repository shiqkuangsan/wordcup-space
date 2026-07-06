import { describe, expect, it } from "vitest";
import { assessOddsCaptureCompleteness } from "@/server/providers/odds-capture-completeness";

describe("assessOddsCaptureCompleteness", () => {
  it("flags empty captures", () => {
    expect(assessOddsCaptureCompleteness([])).toMatchObject({
      status: "empty",
      marketCount: 0,
      rowCount: 0,
    });
  });

  it("flags single-market captures as thin", () => {
    const rows = [
      { market: "full_time:handicap" },
      { market: "full_time:handicap" },
    ];

    expect(assessOddsCaptureCompleteness(rows)).toMatchObject({
      status: "thin",
      marketCount: 1,
      rowCount: 2,
    });
  });

  it("accepts broad common-market captures", () => {
    const markets = [
      "full_time:handicap",
      "full_time:total",
      "full_time:moneyline",
      "full_time:correct_score",
    ];
    const rows = Array.from({ length: 24 }, (_, index) => ({ market: markets[index % markets.length] }));

    expect(assessOddsCaptureCompleteness(rows)).toMatchObject({
      status: "complete",
      marketCount: 4,
      rowCount: 24,
    });
  });
});
