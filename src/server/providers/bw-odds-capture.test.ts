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

  it("parses SABA detail text where odds are split across lines", () => {
    const result = parseBwOddsText({
      matchId: "match-tokenized",
      homeTeam: "英格兰",
      awayTeam: "刚果民主共和国",
      capturedAt: "2026-07-01T15:00:00.000Z",
      text: `
全场让球
英格兰
刚果民主共和国
-1.5
0.99
+1.5
0.93
-1.25
0.71
+1.25
1.26
全场大/小
大
小
2.5
1.04
0.86
2.25
0.77
1.14
全场独赢
英格兰
1.30
和局
5.00
刚果民主共和国
12.00
波胆
1-0
5.1
0-0
10
0-1
23
双重机会
主 或 和局
1.03
主 或 客
1.17
客 或 和局
3.50
双方/一方/两者皆不得分
双方
2.60
一方
1.59
两者皆不
10.00
      `,
    });

    expect(result.parsed).toEqual(expect.arrayContaining([
      expect.objectContaining({ market: "full_time:handicap", selection: "英格兰", line: "-1.5", decimalOdds: 1.99 }),
      expect.objectContaining({ market: "full_time:handicap", selection: "刚果民主共和国", line: "+1.25", decimalOdds: 2.26 }),
      expect.objectContaining({ market: "full_time:total", selection: "大", line: "2.5", decimalOdds: 2.04 }),
      expect.objectContaining({ market: "full_time:moneyline", selection: "和局", decimalOdds: 5 }),
      expect.objectContaining({ market: "full_time:correct_score", selection: "1-0", decimalOdds: 5.1 }),
      expect.objectContaining({ market: "full_time:double_chance", selection: "客 或 和局", decimalOdds: 3.5 }),
      expect.objectContaining({ market: "full_time:btts_three_way", selection: "双方", decimalOdds: 2.6 }),
    ]));
  });
});
