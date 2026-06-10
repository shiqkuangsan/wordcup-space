import { revalidatePath } from "next/cache";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MATCH_STAGE_OPTIONS, MATCH_STATUS_OPTIONS } from "@/domain/match-sync";
import { TEAM_NAME_OPTIONS } from "@/domain/team-names";
import { createMatch } from "@/server/actions/matches";

export function MatchForm() {
  async function action(formData: FormData) {
    "use server";
    await createMatch({
      competition: String(formData.get("competition") || "世界杯"),
      season: String(formData.get("season") || "2026"),
      stage: String(formData.get("stage")),
      homeTeam: String(formData.get("homeTeam")),
      awayTeam: String(formData.get("awayTeam")),
      kickoffAt: String(formData.get("kickoffAt")),
      venue: String(formData.get("venue") || ""),
      status: String(formData.get("status") || "scheduled"),
      dataSource: "manual",
    });
    revalidatePath("/matches");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>新增比赛</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={action} className="grid gap-3 md:grid-cols-2">
          <Input name="competition" defaultValue="世界杯" aria-label="赛事" />
          <Input name="season" defaultValue="2026" aria-label="赛季" />
          <select name="stage" defaultValue="group_stage" className="h-9 rounded-md border bg-background px-3 text-sm">
            {MATCH_STAGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <select name="status" defaultValue="scheduled" className="h-9 rounded-md border bg-background px-3 text-sm">
            {MATCH_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <Input name="kickoffAt" placeholder="开球时间，例如 2026-06-12 20:00" required />
          <Input name="homeTeam" list="world-cup-team-options" placeholder="主队，例如 阿根廷" required />
          <Input name="awayTeam" list="world-cup-team-options" placeholder="客队，例如 日本" required />
          <Input name="venue" placeholder="场地" />
          <datalist id="world-cup-team-options">
            {TEAM_NAME_OPTIONS.map((teamName) => (
              <option key={teamName} value={teamName} />
            ))}
          </datalist>
          <Button type="submit" className="md:col-span-2">
            保存比赛
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
