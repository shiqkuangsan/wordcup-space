import { getPotentialReturnCents } from "@/domain/money";

export type SettlementResult =
  | "won"
  | "lost"
  | "void"
  | "half_won"
  | "half_lost"
  | "cashout"
  | "cancelled";

export const SETTLEMENT_RESULT_OPTIONS: Array<{
  value: SettlementResult;
  label: string;
  needsCashoutAmount?: boolean;
}> = [
  { value: "won", label: "赢：全赢，返还本金+盈利" },
  { value: "lost", label: "输：全输，不再返还" },
  { value: "void", label: "走水：退回本金" },
  { value: "half_won", label: "半赢：半注赢、半注走水" },
  { value: "half_lost", label: "半输：半注输、半注走水" },
  { value: "cashout", label: "提前兑现：按平台兑现额入账", needsCashoutAmount: true },
  { value: "cancelled", label: "取消/无效：退回本金" },
];

type SettlementInput = {
  result: SettlementResult;
  stakeCents: number;
  finalOdds: number;
  cashoutAmountCents?: number;
};

export function calculateSettlement(input: SettlementInput) {
  switch (input.result) {
    case "won": {
      const payoutCents = getPotentialReturnCents(input.stakeCents, input.finalOdds);
      return {
        payoutCents,
        profitLossCents: payoutCents - input.stakeCents,
        ledgerEntryType: "settlement_win" as const,
      };
    }
    case "lost":
      return {
        payoutCents: 0,
        profitLossCents: -input.stakeCents,
        ledgerEntryType: "settlement_loss" as const,
      };
    case "void":
      return {
        payoutCents: input.stakeCents,
        profitLossCents: 0,
        ledgerEntryType: "settlement_void" as const,
      };
    case "half_won": {
      const profitCents = Math.round((getPotentialReturnCents(input.stakeCents, input.finalOdds) - input.stakeCents) / 2);
      return {
        payoutCents: input.stakeCents + profitCents,
        profitLossCents: profitCents,
        ledgerEntryType: "settlement_half_win" as const,
      };
    }
    case "half_lost":
      return {
        payoutCents: Math.round(input.stakeCents / 2),
        profitLossCents: -Math.round(input.stakeCents / 2),
        ledgerEntryType: "settlement_half_loss" as const,
      };
    case "cashout": {
      const payoutCents = input.cashoutAmountCents ?? 0;
      return {
        payoutCents,
        profitLossCents: payoutCents - input.stakeCents,
        ledgerEntryType: "cashout" as const,
      };
    }
    case "cancelled":
      return {
        payoutCents: input.stakeCents,
        profitLossCents: 0,
        ledgerEntryType: "settlement_void" as const,
      };
  }
}
