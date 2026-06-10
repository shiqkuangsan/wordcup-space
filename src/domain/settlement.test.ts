import { describe, expect, it } from "vitest";
import { calculateSettlement } from "@/domain/settlement";

describe("settlement", () => {
  it("returns stake times odds for wins", () => {
    expect(
      calculateSettlement({
        result: "won",
        stakeCents: 10000,
        finalOdds: 2.2,
      }),
    ).toEqual({
      payoutCents: 22000,
      profitLossCents: 12000,
      ledgerEntryType: "settlement_win",
    });
  });

  it("does not return payout for losses", () => {
    expect(
      calculateSettlement({
        result: "lost",
        stakeCents: 10000,
        finalOdds: 2.2,
      }),
    ).toEqual({
      payoutCents: 0,
      profitLossCents: -10000,
      ledgerEntryType: "settlement_loss",
    });
  });

  it("returns stake for void slips", () => {
    expect(
      calculateSettlement({
        result: "void",
        stakeCents: 10000,
        finalOdds: 2.2,
      }),
    ).toEqual({
      payoutCents: 10000,
      profitLossCents: 0,
      ledgerEntryType: "settlement_void",
    });
  });

  it("supports Asian handicap half win and half loss", () => {
    expect(
      calculateSettlement({
        result: "half_won",
        stakeCents: 10000,
        finalOdds: 2.2,
      }),
    ).toEqual({
      payoutCents: 16000,
      profitLossCents: 6000,
      ledgerEntryType: "settlement_half_win",
    });

    expect(
      calculateSettlement({
        result: "half_lost",
        stakeCents: 10000,
        finalOdds: 2.2,
      }),
    ).toEqual({
      payoutCents: 5000,
      profitLossCents: -5000,
      ledgerEntryType: "settlement_half_loss",
    });
  });
});
