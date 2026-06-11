import { revalidatePath } from "next/cache";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MATCH_STATUS_OPTIONS } from "@/domain/match-sync";
import { recordMatchResult } from "@/server/actions/match-results";
import type { matchResults } from "@/db/schema";

type MatchResult = typeof matchResults.$inferSelect;

export function MatchResultForm({
  matchId,
  latestResult,
}: {
  matchId: string;
  latestResult?: MatchResult;
}) {
  async function action(formData: FormData) {
    "use server";
    const homeScoreRaw = String(formData.get("homeScore") || "");
    const awayScoreRaw = String(formData.get("awayScore") || "");

    await recordMatchResult({
      matchId,
      homeScore: homeScoreRaw === "" ? undefined : Number(homeScoreRaw),
      awayScore: awayScoreRaw === "" ? undefined : Number(awayScoreRaw),
      resultStatus: String(formData.get("resultStatus") || "finished"),
      sourceActor: String(formData.get("sourceActor") || "user"),
      sourceNote: String(formData.get("sourceNote") || ""),
      settledAt: String(formData.get("settledAt") || new Date().toISOString()),
    });
    revalidatePath(`/matches/${matchId}`);
    revalidatePath("/bets");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>记录赛果</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {latestResult ? (
          <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
            最近记录：{latestResult.homeScore ?? "-"} : {latestResult.awayScore ?? "-"} · {latestResult.resultStatus} ·{" "}
            {latestResult.sourceActor}
          </div>
        ) : null}
        <form action={action} className="grid gap-3 md:grid-cols-2">
          <Input name="homeScore" type="number" min="0" step="1" placeholder="主队进球" defaultValue={latestResult?.homeScore ?? ""} />
          <Input name="awayScore" type="number" min="0" step="1" placeholder="客队进球" defaultValue={latestResult?.awayScore ?? ""} />
          <select name="resultStatus" defaultValue={latestResult?.resultStatus ?? "finished"} className="h-9 rounded-md border bg-background px-3 text-sm">
            {MATCH_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select name="sourceActor" defaultValue="user" className="h-9 rounded-md border bg-background px-3 text-sm">
            <option value="user">User</option>
            <option value="codex">Codex</option>
            <option value="importer">Provider</option>
          </select>
          <Input name="settledAt" placeholder="记录时间，默认当前" />
          <Input name="sourceNote" placeholder="来源备注，例如 FIFA / 平台比分 / 手工确认" required />
          <Button type="submit" className="md:col-span-2">
            保存赛果
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
