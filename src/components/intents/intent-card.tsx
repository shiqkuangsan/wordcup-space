import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IntentExecutionPanel } from "@/components/intents/intent-execution-panel";
import { formatBetModeLabel, formatDecisionByLabel, formatIntentStatus, formatRiskTierLabel } from "@/domain/display-labels";
import { formatCny } from "@/domain/money";
import type { betIntentLegs, betIntents, platformAccounts } from "@/db/schema";

type Intent = typeof betIntents.$inferSelect;
type IntentLeg = typeof betIntentLegs.$inferSelect;
type PlatformAccount = typeof platformAccounts.$inferSelect;

export function IntentCard({
  intent,
  legs,
  platformAccounts,
}: {
  intent: Intent;
  legs: IntentLeg[];
  platformAccounts: PlatformAccount[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <span>{formatDecisionByLabel(intent.decisionBy)} / {formatBetModeLabel(intent.mode)}</span>
          <Badge variant="outline">{formatIntentStatus(intent.status)}</Badge>
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
                <span>
                  {leg.matchText ?? leg.matchId ?? "未绑定比赛"} · {leg.market} · {leg.selection}
                  {leg.line ? ` ${leg.line}` : ""}
                </span>
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
