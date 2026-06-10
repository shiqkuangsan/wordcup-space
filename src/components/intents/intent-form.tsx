import { revalidatePath } from "next/cache";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { BET_PERIOD_OPTIONS, MARKET_TYPE_OPTIONS } from "@/domain/betting-markets";
import { formatMatchTitle } from "@/domain/team-names";
import { addBetIntentLeg, createBetIntent } from "@/server/actions/intents";
import type { matches } from "@/db/schema";

type Match = typeof matches.$inferSelect;

const riskTierOptions = [
  { value: "normal", label: "普通单场（10%）" },
  { value: "high_confidence", label: "高信心单场（20%）" },
  { value: "parlay", label: "串关（5%）" },
];

const confidenceOptions = [
  { value: "low", label: "低信心" },
  { value: "medium", label: "中等信心" },
  { value: "high", label: "高信心" },
];

export function IntentForm({ matches }: { matches: Match[] }) {
  async function action(formData: FormData) {
    "use server";
    const market = `${String(formData.get("period"))}:${String(formData.get("market"))}`;
    const intent = await createBetIntent({
      portfolioId: String(formData.get("portfolioId")) as "user" | "codex",
      decisionBy: String(formData.get("decisionBy")) as "user" | "codex",
      mode: String(formData.get("mode")) as "single" | "parlay",
      market,
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
        market,
        selection: String(formData.get("selection")),
        line: String(formData.get("line") || ""),
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
                {formatMatchTitle(match.homeTeam, match.awayTeam)}
              </option>
            ))}
          </select>
          <select name="period" defaultValue="full_time" className="h-9 rounded-md border bg-background px-3 text-sm">
            {BET_PERIOD_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <select name="market" defaultValue="moneyline" className="h-9 rounded-md border bg-background px-3 text-sm">
            {MARKET_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <Input name="selection" placeholder="选择，例如 阿根廷胜 / 大 2.5 / 第 1 球巴西" required />
          <Input name="line" placeholder="盘口线，例如 -0.5 / 2.5 / 第1球，可空" />
          <Input name="stake" type="number" step="0.01" placeholder="预期金额" required />
          <Input name="odds" type="number" step="0.01" placeholder="预期总赔率" required />
          <select name="riskTier" defaultValue="normal" className="h-9 rounded-md border bg-background px-3 text-sm">
            {riskTierOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <select name="confidence" defaultValue="medium" className="h-9 rounded-md border bg-background px-3 text-sm">
            {confidenceOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <Textarea name="rationale" placeholder="决策理由" required className="md:col-span-2" />
          <Button type="submit" className="md:col-span-2">保存 intent</Button>
        </form>
      </CardContent>
    </Card>
  );
}
