import { describe, expect, it } from "vitest";
import { validateBwPageTextForMatch } from "@/server/providers/bw-page-text";

describe("validateBwPageTextForMatch", () => {
  it("accepts copied BW detail text for the intended match", () => {
    const validation = validateBwPageTextForMatch({
      homeTeam: "巴西",
      awayTeam: "日本",
      text: `
        *FIFA世界杯2026(在加拿大,墨西哥和美国)
        巴西 vs 日本
        全场让球
        巴西 -0.5 1.79 日本 +0.5 2.10
        全场大小
        大 2.5 1.91 小 2.5 1.89
        波胆
        2-1 9.50 1-1 6.74
      `,
    });

    expect(validation.ok).toBe(true);
    expect(validation.marketHintCount).toBeGreaterThanOrEqual(3);
  });

  it("recognizes BW Chinese team aliases", () => {
    const validation = validateBwPageTextForMatch({
      homeTeam: "科特迪瓦",
      awayTeam: "突尼斯",
      text: `
        世界杯
        象牙海岸 vs 突尼西亚
        全场独赢
        2.05 3.50 3.60
        上半场大小
        大 1 1.86 小 1 2.01
      `,
    });

    expect(validation.ok).toBe(true);
    expect(validation.homeMatched).toBe(true);
    expect(validation.awayMatched).toBe(true);
  });

  it("rejects text that does not look like the target match page", () => {
    const validation = validateBwPageTextForMatch({
      homeTeam: "德国",
      awayTeam: "巴拉圭",
      text: "我的注单 余额 RMB 100.00",
    });

    expect(validation.ok).toBe(false);
    expect(validation.warnings).toContain("复制到的页面文本过短，可能没有选中比赛详情内容。");
  });
});
