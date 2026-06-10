import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatBetModeLabel, formatDecisionByLabel, formatIntentStatus, formatRiskTierLabel } from "@/domain/display-labels";
import { formatCny } from "@/domain/money";
import type { betIntents } from "@/db/schema";

type Intent = typeof betIntents.$inferSelect;

export function IntentCard({ intent }: { intent: Intent }) {
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
        <p className="text-sm text-muted-foreground">{intent.rationale}</p>
      </CardContent>
    </Card>
  );
}
