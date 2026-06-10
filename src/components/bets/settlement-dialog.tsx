import { revalidatePath } from "next/cache";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatActorLabel, formatDecisionByLabel } from "@/domain/display-labels";
import { formatCny } from "@/domain/money";
import { SETTLEMENT_RESULT_OPTIONS } from "@/domain/settlement";
import { settleBetSlip } from "@/server/actions/settlements";
import type { betSlips } from "@/db/schema";

type Slip = typeof betSlips.$inferSelect;

export function SettlementDialog({ openSlips }: { openSlips: Slip[] }) {
  async function action(formData: FormData) {
    "use server";
    await settleBetSlip({
      betSlipId: String(formData.get("betSlipId")),
      result: String(formData.get("result")) as "won" | "lost" | "void" | "half_won" | "half_lost" | "cashout" | "cancelled",
      cashoutAmountCents: formData.get("cashoutAmount")
        ? Math.round(Number(formData.get("cashoutAmount")) * 100)
        : undefined,
      sourceNote: String(formData.get("sourceNote")),
    });
    revalidatePath("/bets");
    revalidatePath("/bankroll");
    revalidatePath("/");
  }

  return (
    <Card>
      <CardHeader><CardTitle>结算注单</CardTitle></CardHeader>
      <CardContent>
        <form action={action} className="space-y-3">
          <select name="betSlipId" className="h-9 w-full rounded-md border bg-background px-3 text-sm">
            <option value="">选择一张未结算注单</option>
            {openSlips.map((slip) => (
              <option key={slip.id} value={slip.id}>
                {slip.confirmationRef || slip.id} | {formatActorLabel(slip.portfolioId)} / {formatDecisionByLabel(slip.decisionBy)} | {formatCny(slip.stakeCents)} @ {slip.finalOdds.toFixed(2)} | 最高返还 {formatCny(slip.potentialReturnCents)}
              </option>
            ))}
          </select>
          <select name="result" className="h-9 w-full rounded-md border bg-background px-3 text-sm">
            {SETTLEMENT_RESULT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <Input name="cashoutAmount" type="number" step="0.01" placeholder="提前兑现到账金额，仅提前兑现时必填" />
          <Input name="sourceNote" placeholder="结算依据，例如 平台已结算/截图/比分来源" required />
          <Button type="submit" className="w-full" disabled={openSlips.length === 0}>结算</Button>
        </form>
      </CardContent>
    </Card>
  );
}
