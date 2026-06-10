import { describe, expect, it } from "vitest";
import { formatMatchTitle, formatTeamName } from "@/domain/team-names";

describe("team name formatting", () => {
  it("keeps Chinese team names as-is", () => {
    expect(formatTeamName("阿根廷")).toBe("阿根廷");
  });

  it("maps common English names and FIFA codes to Chinese", () => {
    expect(formatTeamName("Argentina")).toBe("阿根廷");
    expect(formatTeamName("JPN")).toBe("日本");
    expect(formatMatchTitle("United States", "Mexico")).toBe("美国 vs 墨西哥");
    expect(formatMatchTitle("Bosnia & Herzegovina", "DR Congo")).toBe("波黑 vs 刚果民主共和国");
  });

  it("preserves suffixes used by tests or imported source labels", () => {
    expect(formatTeamName("Argentina 1781028")).toBe("阿根廷 1781028");
  });
});
