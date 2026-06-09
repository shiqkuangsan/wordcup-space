import { describe, expect, it } from "vitest";
import { getLedgerSignedAmount, getNextBalanceCents } from "@/domain/ledger";

describe("ledger", () => {
  it("adds allocations and top ups", () => {
    expect(
      getNextBalanceCents({
        currentBalanceCents: 0,
        entryType: "allocation_initial",
        amountCents: 100000,
      }),
    ).toBe(100000);

    expect(
      getNextBalanceCents({
        currentBalanceCents: 100000,
        entryType: "allocation_top_up",
        amountCents: 50000,
      }),
    ).toBe(150000);
  });

  it("subtracts withdrawals and stake paid", () => {
    expect(
      getNextBalanceCents({
        currentBalanceCents: 100000,
        entryType: "allocation_withdrawal",
        amountCents: 50000,
      }),
    ).toBe(50000);

    expect(
      getNextBalanceCents({
        currentBalanceCents: 100000,
        entryType: "stake_paid",
        amountCents: 10000,
      }),
    ).toBe(90000);
  });

  it("does not double deduct losing settlement", () => {
    expect(getLedgerSignedAmount("settlement_loss", 10000)).toBe(0);
    expect(
      getNextBalanceCents({
        currentBalanceCents: 90000,
        entryType: "settlement_loss",
        amountCents: 10000,
      }),
    ).toBe(90000);
  });
});
