import { describe, expect, it } from "vitest";
import { parseBwOddsText } from "@/server/providers/bw-odds-capture";

describe("parseBwOddsText", () => {
  it("parses common BW football markets from copied text", () => {
    const result = parseBwOddsText({
      matchId: "match-demo",
      homeTeam: "德国",
      awayTeam: "库拉索",
      capturedAt: "2026-06-14T10:00:00.000Z",
      text: `
全场让球
德国 库拉索
-3.5 0.96 +3.5 0.92
-3 0.74 +3 1.16
全场大小
大 小
4.25 0.92 4.25 0.96
4.5 1.09 4.5 0.77
全场独赢
德国 和局 库拉索
1.03 20.00 30.00
波胆
德国赢 和 库拉索赢
1-0 17 0-0 30 0-1 163
2-0 8.3 1-1 42 0-2 288
上半场大小
1.75 0.78 1.75 1.08
      `,
    });

    expect(result.parsed).toEqual(expect.arrayContaining([
      expect.objectContaining({ market: "full_time:handicap", selection: "德国", line: "-3.5", decimalOdds: 1.96, rawFormat: "hong_kong" }),
      expect.objectContaining({ market: "full_time:handicap", selection: "库拉索", line: "+3.5", decimalOdds: 1.92, rawFormat: "hong_kong" }),
      expect.objectContaining({ market: "full_time:total", selection: "大", line: "4.25", decimalOdds: 1.92, rawFormat: "hong_kong" }),
      expect.objectContaining({ market: "full_time:moneyline", selection: "德国", decimalOdds: 1.03, rawFormat: "decimal" }),
      expect.objectContaining({ market: "full_time:moneyline", selection: "和局", decimalOdds: 20, rawFormat: "decimal" }),
      expect.objectContaining({ market: "full_time:correct_score", selection: "1-0", decimalOdds: 17 }),
      expect.objectContaining({ market: "half_time:total", selection: "小", line: "1.75", decimalOdds: 2.08 }),
    ]));
  });
});
