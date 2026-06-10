export type LedgerEntryType =
  | "allocation_initial"
  | "allocation_top_up"
  | "allocation_withdrawal"
  | "stake_paid"
  | "settlement_win"
  | "settlement_loss"
  | "settlement_void"
  | "settlement_half_win"
  | "settlement_half_loss"
  | "cashout"
  | "adjustment";

export const LEDGER_ENTRY_TYPE_LABELS: Record<LedgerEntryType, string> = {
  allocation_initial: "初始额度",
  allocation_top_up: "追加额度",
  allocation_withdrawal: "提取额度",
  stake_paid: "下注扣款",
  settlement_win: "赢单结算",
  settlement_loss: "输单结算",
  settlement_void: "走水退款",
  settlement_half_win: "半赢结算",
  settlement_half_loss: "半输结算",
  cashout: "提前兑现",
  adjustment: "人工调整",
};

type NextBalanceInput = {
  currentBalanceCents: number;
  entryType: LedgerEntryType;
  amountCents: number;
};

export function formatLedgerEntryType(entryType: string): string {
  return LEDGER_ENTRY_TYPE_LABELS[entryType as LedgerEntryType] ?? entryType;
}

export function getLedgerSignedAmount(entryType: LedgerEntryType, amountCents: number) {
  switch (entryType) {
    case "allocation_initial":
    case "allocation_top_up":
    case "settlement_win":
    case "settlement_void":
    case "settlement_half_win":
    case "settlement_half_loss":
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
