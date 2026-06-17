import { describe, expect, it } from "vitest";
import { formatTeamName } from "@/domain/team-names";

describe("SABA odds helpers", () => {
  it("normalizes SABA Chinese team aliases used by BW", () => {
    expect(formatTeamName("象牙海岸")).toBe("科特迪瓦");
    expect(formatTeamName("突尼西亚")).toBe("突尼斯");
    expect(formatTeamName("沙地阿拉伯")).toBe("沙特阿拉伯");
    expect(formatTeamName("纽西兰")).toBe("新西兰");
    expect(formatTeamName("乌兹别克")).toBe("乌兹别克斯坦");
  });
});
