import { describe, expect, it } from "vitest";
import { formatTeamName } from "@/domain/team-names";

describe("SABA odds helpers", () => {
  it("normalizes SABA Chinese team aliases used by BW", () => {
    expect(formatTeamName("象牙海岸")).toBe("科特迪瓦");
    expect(formatTeamName("突尼西亚")).toBe("突尼斯");
  });
});
