import { revalidatePath } from "next/cache";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createMatch } from "@/server/actions/matches";

export function MatchForm() {
  async function action(formData: FormData) {
    "use server";
    await createMatch({
      competition: String(formData.get("competition") || "FIFA World Cup"),
      season: String(formData.get("season") || "2026"),
      stage: String(formData.get("stage")),
      homeTeam: String(formData.get("homeTeam")),
      awayTeam: String(formData.get("awayTeam")),
      kickoffAt: String(formData.get("kickoffAt")),
      venue: String(formData.get("venue") || ""),
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
          <Input name="competition" defaultValue="FIFA World Cup" aria-label="赛事" />
          <Input name="season" defaultValue="2026" aria-label="赛季" />
          <Input name="stage" placeholder="阶段，例如 group" required />
          <Input name="kickoffAt" placeholder="开球时间 ISO" required />
          <Input name="homeTeam" placeholder="主队" required />
          <Input name="awayTeam" placeholder="客队" required />
          <Input name="venue" placeholder="场地" />
          <Button type="submit" className="md:col-span-2">
            保存比赛
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
