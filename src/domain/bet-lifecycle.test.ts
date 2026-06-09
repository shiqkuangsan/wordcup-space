import { describe, expect, it } from "vitest";
import { canCreateBetSlip, canExpireIntent, canSettleBetSlip } from "@/domain/bet-lifecycle";

describe("bet lifecycle", () => {
  it("blocks failed attempts from creating bet slips", () => {
    expect(canCreateBetSlip({ status: "failed" })).toBe(false);
  });

  it("allows succeeded attempts when odds tolerance passes", () => {
    expect(
      canCreateBetSlip({
        status: "succeeded",
        oddsChangePct: 0.059,
        oddsTolerancePct: 0.06,
      }),
    ).toBe(true);
  });

  it("blocks succeeded attempts when odds tolerance is reached", () => {
    expect(
      canCreateBetSlip({
        status: "succeeded",
        oddsChangePct: 0.06,
        oddsTolerancePct: 0.06,
      }),
    ).toBe(false);
  });

  it("allows only open bet slips to settle", () => {
    expect(canSettleBetSlip({ status: "open" })).toBe(true);
    expect(canSettleBetSlip({ status: "won" })).toBe(false);
  });

  it("expires active intents after their expiry time", () => {
    expect(
      canExpireIntent(
        { status: "approved", expiresAt: "2026-06-10T10:00:00Z" },
        new Date("2026-06-10T10:00:01Z"),
      ),
    ).toBe(true);

    expect(
      canExpireIntent(
        { status: "executed", expiresAt: "2026-06-10T10:00:00Z" },
        new Date("2026-06-10T10:00:01Z"),
      ),
    ).toBe(false);
  });
});
