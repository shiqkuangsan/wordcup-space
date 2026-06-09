import { revalidatePath } from "next/cache";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { addBetIntentLeg, createBetIntent } from "@/server/actions/intents";
import type { matches } from "@/db/schema";

type Match = typeof matches.$inferSelect;

export function IntentForm({ matches }: { matches: Match[] }) {
  async function action(formData: FormData) {
    "use server";
    const intent = await createBetIntent({
      portfolioId: String(formData.get("portfolioId")) as "user" | "codex",
      decisionBy: String(formData.get("decisionBy")) as "user" | "codex",
      mode: String(formData.get("mode")) as "single" | "parlay",
      market: String(formData.get("market")),
      intendedStakeCents: Math.round(Number(formData.get("stake")) * 100),
      intendedTotalOdds: Number(formData.get("odds")),
      riskTier: String(formData.get("riskTier")),
      confidence: String(formData.get("confidence")),
      rationale: String(formData.get("rationale")),
    });

    const matchId = String(formData.get("matchId") || "");
    if (matchId) {
      await addBetIntentLeg({
        betIntentId: intent.id,
        matchId,
        market: String(formData.get("market")),
        selection: String(formData.get("selection")),
        intendedOdds: Number(formData.get("odds")),
        legOrder: 1,
      });
    }

    revalidatePath("/intents");
    revalidatePath("/");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>创建决策 intent</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={action} className="grid gap-3 md:grid-cols-2">
          <select name="portfolioId" defaultValue="codex" className="h-9 rounded-md border bg-background px-3 text-sm">
            <option value="codex">Codex</option>
            <option value="user">User</option>
          </select>
          <select name="decisionBy" defaultValue="codex" className="h-9 rounded-md border bg-background px-3 text-sm">
            <option value="codex">Codex 决策</option>
            <option value="user">User 决策</option>
          </select>
          <select name="mode" defaultValue="single" className="h-9 rounded-md border bg-background px-3 text-sm">
            <option value="single">单场</option>
            <option value="parlay">串关</option>
          </select>
          <select name="matchId" className="h-9 rounded-md border bg-background px-3 text-sm">
            <option value="">暂不绑定比赛</option>
            {matches.map((match) => (
              <option key={match.id} value={match.id}>
                {match.homeTeam} vs {match.awayTeam}
              </option>
            ))}
          </select>
          <Input name="market" placeholder="市场，例如 1X2" required />
          <Input name="selection" placeholder="选择，例如 Argentina" required />
          <Input name="stake" type="number" step="0.01" placeholder="预期金额" required />
          <Input name="odds" type="number" step="0.01" placeholder="预期总赔率" required />
          <Input name="riskTier" defaultValue="normal" />
          <Input name="confidence" defaultValue="medium" />
          <Textarea name="rationale" placeholder="决策理由" required className="md:col-span-2" />
          <Button type="submit" className="md:col-span-2">保存 intent</Button>
        </form>
      </CardContent>
    </Card>
  );
}
