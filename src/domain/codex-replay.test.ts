import { describe, expect, it } from "vitest";
import { settleIntentLegFromMatchResult } from "@/domain/codex-replay";

const mexicoSouthAfrica = {
  homeTeam: "墨西哥",
  awayTeam: "南非",
  homeScore: 2,
  awayScore: 0,
  resultStatus: "finished",
};

const koreaCzechia = {
  homeTeam: "韩国",
  awayTeam: "捷克",
  homeScore: 2,
  awayScore: 1,
  resultStatus: "finished",
};

describe("codex decision replay", () => {
  it("settles full-time moneyline from match result", () => {
    expect(
      settleIntentLegFromMatchResult({
        leg: { market: "full_time:moneyline", selection: "和局" },
        matchResult: koreaCzechia,
        stakeCents: 3000,
        odds: 2.7,
      }),
    ).toMatchObject({ status: "settled", result: "lost", profitLossCents: -3000 });
  });

  it("settles correct score", () => {
    expect(
      settleIntentLegFromMatchResult({
        leg: { market: "full_time:correct_score", selection: "1-1" },
        matchResult: koreaCzechia,
        stakeCents: 1000,
        odds: 6.41,
      }),
    ).toMatchObject({ status: "settled", result: "lost", profitLossCents: -1000 });
  });

  it("settles Asian total quarter line", () => {
    expect(
      settleIntentLegFromMatchResult({
        leg: { market: "full_time:total", selection: "大", line: "2/2.5" },
        matchResult: koreaCzechia,
        stakeCents: 6000,
        odds: 1.96,
      }),
    ).toMatchObject({ status: "settled", result: "won", profitLossCents: 5760 });
  });

  it("settles Asian handicap quarter line", () => {
    expect(
      settleIntentLegFromMatchResult({
        leg: { market: "full_time:handicap", selection: "墨西哥", line: "-1/1.5" },
        matchResult: mexicoSouthAfrica,
        stakeCents: 4000,
        odds: 2.075,
      }),
    ).toMatchObject({ status: "settled", result: "won", profitLossCents: 4300 });
  });

  it("keeps unfinished matches pending", () => {
    expect(
      settleIntentLegFromMatchResult({
        leg: { market: "full_time:moneyline", selection: "加拿大" },
        matchResult: { homeTeam: "加拿大", awayTeam: "波黑", homeScore: null, awayScore: null, resultStatus: null },
        stakeCents: 5000,
        odds: 1.86,
      }),
    ).toMatchObject({ status: "pending_result" });
  });
});
