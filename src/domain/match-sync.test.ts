import { describe, expect, it } from "vitest";
import {
  formatMatchStage,
  formatMatchStatus,
  normalizeMatchStage,
  normalizeMatchStatus,
  syncMatchesPayloadSchema,
} from "@/domain/match-sync";

describe("match sync normalization", () => {
  it("normalizes public schedule stages into canonical values", () => {
    expect(normalizeMatchStage("Group Stage")).toBe("group_stage");
    expect(normalizeMatchStage("Round of 16")).toBe("round_of_16");
    expect(normalizeMatchStage("8强")).toBe("quarter_final");
    expect(normalizeMatchStage("Quarter-final")).toBe("quarter_final");
    expect(normalizeMatchStage("Semi-final")).toBe("semi_final");
  });

  it("normalizes match status aliases", () => {
    expect(normalizeMatchStatus("not started")).toBe("scheduled");
    expect(normalizeMatchStatus("比赛中")).toBe("live");
    expect(normalizeMatchStatus("Full Time")).toBe("finished");
  });

  it("formats canonical values for Chinese UI", () => {
    expect(formatMatchStage("round_of_32")).toBe("32 强");
    expect(formatMatchStatus("finished")).toBe("已完结");
  });

  it("parses a normalized schedule payload", () => {
    const payload = syncMatchesPayloadSchema.parse({
      sourceName: "manual-browser",
      matches: [
        {
          externalId: "m1",
          stage: "小组赛",
          homeTeam: "阿根廷",
          awayTeam: "日本",
          kickoffAt: "2026-06-12T20:00:00+08:00",
          status: "未开赛",
        },
      ],
    });

    expect(payload.matches[0].stage).toBe("group_stage");
    expect(payload.matches[0].status).toBe("scheduled");
  });
});
