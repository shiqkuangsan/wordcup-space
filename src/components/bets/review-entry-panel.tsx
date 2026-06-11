import { revalidatePath } from "next/cache";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { formatBetSlipStatus } from "@/domain/display-labels";
import { formatCny } from "@/domain/money";
import { recordDecisionReview } from "@/server/actions/decision-reviews";
import type { betSlips, decisionReviews } from "@/db/schema";

type Slip = typeof betSlips.$inferSelect & {
  matchSummary?: string;
  selectionSummary?: string;
};

type Review = typeof decisionReviews.$inferSelect;

export function ReviewEntryPanel({
  settledSlips,
  reviews,
}: {
  settledSlips: Slip[];
  reviews: Review[];
}) {
  async function action(formData: FormData) {
    "use server";

    await recordDecisionReview({
      betSlipId: String(formData.get("betSlipId") || ""),
      reviewer: String(formData.get("reviewer") || "user") as "user" | "codex",
      rating: String(formData.get("rating") || ""),
      reviewNote: String(formData.get("reviewNote") || ""),
    });
    revalidatePath("/bets");
    revalidatePath("/");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>赛后复盘</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-3">
          <select
            name="betSlipId"
            disabled={settledSlips.length === 0}
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
          >
            {settledSlips.map((slip) => (
              <option key={slip.id} value={slip.id}>
                {slip.matchSummary ?? slip.id} · {slip.selectionSummary ?? "未记录选择"} · {formatBetSlipStatus(slip.status)} ·{" "}
                {formatCny(slip.stakeCents)}
              </option>
            ))}
            {settledSlips.length === 0 ? <option value="">暂无已结算 slip</option> : null}
          </select>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
            <select name="reviewer" defaultValue="user" className="h-9 rounded-md border bg-background px-3 text-sm">
              <option value="user">User 复盘</option>
              <option value="codex">Codex 复盘</option>
            </select>
            <select name="rating" defaultValue="ok" className="h-9 rounded-md border bg-background px-3 text-sm">
              <option value="good">判断有效</option>
              <option value="ok">中性</option>
              <option value="bad">判断失误</option>
              <option value="execution_issue">执行问题</option>
              <option value="data_issue">数据问题</option>
            </select>
          </div>
          <Textarea name="reviewNote" placeholder="复盘：当时盘口、判断理由、反方证据、执行质量、以后怎么改" required />
          <Button type="submit" disabled={settledSlips.length === 0} className="w-full">
            保存复盘
          </Button>
          <p className="text-xs text-muted-foreground">已记录 {reviews.length} 条 decision review。</p>
        </form>
      </CardContent>
    </Card>
  );
}
