import { getPotentialReturnCents } from "@/domain/money";

export type SettlementResult = "won" | "lost" | "void" | "cashout";

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
    case "cashout": {
      const payoutCents = input.cashoutAmountCents ?? 0;
      return {
        payoutCents,
        profitLossCents: payoutCents - input.stakeCents,
        ledgerEntryType: "cashout" as const,
      };
    }
  }
}
