import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IntentExecutionPanel } from "@/components/intents/intent-execution-panel";
import { formatMarketLabel } from "@/domain/betting-markets";
import { formatBetModeLabel, formatDecisionByLabel, formatIntentStatus, formatRiskTierLabel } from "@/domain/display-labels";
import { formatCny } from "@/domain/money";
import type { betIntentLegs, betIntents, platformAccounts } from "@/db/schema";

type Intent = typeof betIntents.$inferSelect;
type IntentLeg = typeof betIntentLegs.$inferSelect & {
  matchHref?: string;
  matchTitle?: string;
};
type PlatformAccount = typeof platformAccounts.$inferSelect;

export function IntentCard({
  intent,
  legs,
  betSlipCount = 0,
  platformAccounts,
}: {
  intent: Intent;
  legs: IntentLeg[];
  betSlipCount?: number;
  platformAccounts: PlatformAccount[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <span>{formatDecisionByLabel(intent.decisionBy)} / {formatBetModeLabel(intent.mode)}</span>
          <span className="flex items-center gap-2">
            {betSlipCount > 0 ? (
              <Link
                href={`/bets?q=${encodeURIComponent(intent.id)}`}
                className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                查看注单 {betSlipCount}
              </Link>
            ) : null}
            <Badge variant="outline">{formatIntentStatus(intent.status)}</Badge>
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 text-sm md:grid-cols-3">
          <div>金额：{formatCny(intent.intendedStakeCents)}</div>
          <div>赔率：{intent.intendedTotalOdds.toFixed(2)}</div>
          <div>风险：{formatRiskTierLabel(intent.riskTier)}</div>
        </div>
        {legs.length ? (
          <div className="space-y-1 rounded-md border bg-muted/30 px-3 py-2 text-sm">
            {legs.map((leg) => (
              <div key={leg.id} className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  {leg.matchHref ? (
                    <Link href={leg.matchHref} className="font-medium underline-offset-4 hover:underline">
                      {leg.matchTitle ?? "未关联比赛"}
                    </Link>
                  ) : (
                    <span className="font-medium">{leg.matchTitle ?? leg.matchText ?? "未关联比赛"}</span>
                  )}
                  <span className="text-muted-foreground">
                    {" · "}
                    {formatMarketLabel(leg.market)}
                    {" · "}
                    {leg.selection}
                    {leg.line ? ` ${leg.line}` : ""}
                  </span>
                </div>
                <span className="font-mono text-xs text-muted-foreground">{leg.intendedOdds.toFixed(2)}</span>
              </div>
            ))}
          </div>
        ) : null}
        <p className="text-sm text-muted-foreground">{intent.rationale}</p>
        <IntentExecutionPanel intent={intent} platformAccounts={platformAccounts} />
      </CardContent>
    </Card>
  );
}
