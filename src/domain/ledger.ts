export type LedgerEntryType =
  | "allocation_initial"
  | "allocation_top_up"
  | "allocation_withdrawal"
  | "stake_paid"
  | "settlement_win"
  | "settlement_loss"
  | "settlement_void"
  | "cashout"
  | "adjustment";

type NextBalanceInput = {
  currentBalanceCents: number;
  entryType: LedgerEntryType;
  amountCents: number;
};

export function getLedgerSignedAmount(entryType: LedgerEntryType, amountCents: number) {
  switch (entryType) {
    case "allocation_initial":
    case "allocation_top_up":
    case "settlement_win":
    case "settlement_void":
    case "cashout":
      return Math.abs(amountCents);
    case "allocation_withdrawal":
    case "stake_paid":
      return -Math.abs(amountCents);
    case "settlement_loss":
      return 0;
    case "adjustment":
      return amountCents;
  }
}

export function getNextBalanceCents(input: NextBalanceInput) {
  return (
    input.currentBalanceCents +
    getLedgerSignedAmount(input.entryType, input.amountCents)
  );
}
