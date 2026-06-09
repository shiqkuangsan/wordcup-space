import { revalidatePath } from "next/cache";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { settleBetSlip } from "@/server/actions/settlements";
import type { betSlips } from "@/db/schema";

type Slip = typeof betSlips.$inferSelect;

export function SettlementDialog({ openSlips }: { openSlips: Slip[] }) {
  async function action(formData: FormData) {
    "use server";
    await settleBetSlip({
      betSlipId: String(formData.get("betSlipId")),
      result: String(formData.get("result")) as "won" | "lost" | "void" | "cashout",
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
            {openSlips.map((slip) => (
              <option key={slip.id} value={slip.id}>
                {slip.confirmationRef || slip.id} / {slip.portfolioId} / {slip.stakeCents / 100} @ {slip.finalOdds}
              </option>
            ))}
          </select>
          <select name="result" className="h-9 w-full rounded-md border bg-background px-3 text-sm">
            <option value="won">赢</option>
            <option value="lost">输</option>
            <option value="void">void</option>
            <option value="cashout">cashout</option>
          </select>
          <Input name="cashoutAmount" type="number" step="0.01" placeholder="cashout 金额，可空" />
          <Input name="sourceNote" placeholder="赛果/结算来源" required />
          <Button type="submit" className="w-full" disabled={openSlips.length === 0}>结算</Button>
        </form>
      </CardContent>
    </Card>
  );
}
