import { revalidatePath } from "next/cache";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatCny } from "@/domain/money";
import type { betIntents } from "@/db/schema";
import { createBetSlipFromAttempt } from "@/server/actions/bet-slips";
import { createExecutionAttempt, markExecutionAttempt } from "@/server/actions/execution-attempts";

type Intent = typeof betIntents.$inferSelect;

export function IntentCard({ intent }: { intent: Intent }) {
  async function action(formData: FormData) {
    "use server";
    const observedOdds = Number(formData.get("observedOdds"));
    const attempt = await createExecutionAttempt({
      betIntentId: intent.id,
      executionMethod: String(formData.get("executionMethod")) as "user_manual",
      platformAccountId: String(formData.get("platformAccountId")),
      intendedOdds: intent.intendedTotalOdds,
      observedOdds,
      status: "pending",
      notes: String(formData.get("notes") || ""),
    });
    await markExecutionAttempt({
      id: attempt.id,
      status: "succeeded",
      observedOdds,
      notes: "执行成功，准备生成注单。",
    });
    await createBetSlipFromAttempt({
      executionAttemptId: attempt.id,
      platformAccountId: String(formData.get("platformAccountId")),
      stakeCents: Math.round(Number(formData.get("stake")) * 100),
      finalOdds: Number(formData.get("finalOdds")),
      isRealMoney: formData.get("isRealMoney") === "true",
      confirmationRef: String(formData.get("confirmationRef") || ""),
    });
    revalidatePath("/intents");
    revalidatePath("/bets");
    revalidatePath("/");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <span>{intent.decisionBy} / {intent.mode}</span>
          <Badge variant="outline">{intent.status}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 text-sm md:grid-cols-3">
          <div>金额：{formatCny(intent.intendedStakeCents)}</div>
          <div>赔率：{intent.intendedTotalOdds.toFixed(2)}</div>
          <div>风险：{intent.riskTier}</div>
        </div>
        <p className="text-sm text-muted-foreground">{intent.rationale}</p>
        <form action={action} className="grid gap-3 md:grid-cols-2">
          <Input name="platformAccountId" defaultValue="bet365-main" />
          <Input name="executionMethod" defaultValue="user_manual" />
          <Input name="observedOdds" type="number" step="0.01" defaultValue={intent.intendedTotalOdds} required />
          <Input name="finalOdds" type="number" step="0.01" defaultValue={intent.intendedTotalOdds} required />
          <Input name="stake" type="number" step="0.01" defaultValue={(intent.intendedStakeCents / 100).toFixed(2)} required />
          <select name="isRealMoney" defaultValue="false" className="h-9 rounded-md border bg-background px-3 text-sm">
            <option value="false">模拟记录</option>
            <option value="true">真实资金</option>
          </select>
          <Input name="confirmationRef" placeholder="平台注单号/确认备注" className="md:col-span-2" />
          <Textarea name="notes" placeholder="执行备注" className="md:col-span-2" />
          <Button type="submit" className="md:col-span-2">标记执行成功并生成注单</Button>
        </form>
      </CardContent>
    </Card>
  );
}
