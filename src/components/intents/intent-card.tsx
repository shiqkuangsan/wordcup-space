import Link from "next/link";
import { ChevronDown, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IntentExecutionPanel } from "@/components/intents/intent-execution-panel";
import { getEffectiveIntentStatus } from "@/domain/bet-lifecycle";
import { formatMarketLabel } from "@/domain/betting-markets";
import { formatLocalMinute } from "@/domain/dates";
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
  attemptCount = 0,
  failedAttemptCount = 0,
  actionHint,
  platformAccounts,
  now = new Date(),
}: {
  intent: Intent;
  legs: IntentLeg[];
  betSlipCount?: number;
  attemptCount?: number;
  failedAttemptCount?: number;
  actionHint?: string;
  platformAccounts: PlatformAccount[];
  now?: Date;
}) {
  const effectiveStatus = getEffectiveIntentStatus(intent, now);
  const isStatusCorrected = effectiveStatus !== intent.status;
  const potentialReturnCents = Math.round(intent.intendedStakeCents * intent.intendedTotalOdds);
  const firstLinkedLeg = legs.find((leg) => leg.matchHref);

  return (
    <Card size="sm" className={isStatusCorrected ? "border-amber-500/40 bg-amber-500/5" : undefined}>
      <CardHeader>
        <CardTitle className="flex min-w-0 items-start justify-between gap-3 text-sm">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span>{formatDecisionByLabel(intent.decisionBy)}</span>
              <Badge variant="outline">{formatBetModeLabel(intent.mode)}</Badge>
              <Badge variant={effectiveStatus === "expired" ? "destructive" : "outline"}>
                {formatIntentStatus(effectiveStatus)}
              </Badge>
              {actionHint ? <Badge variant="secondary">{actionHint}</Badge> : null}
              {isStatusCorrected ? <Badge variant="outline">状态待归档</Badge> : null}
            </div>
            <div className="mt-1 truncate font-mono text-xs font-normal text-muted-foreground">{intent.id}</div>
          </div>
          <div className="flex shrink-0 flex-wrap justify-end gap-2">
            <Link
              href={`/intents?q=${encodeURIComponent(intent.id)}`}
              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              定位
              <ExternalLink className="size-3" />
            </Link>
            {firstLinkedLeg?.matchHref ? (
              <Link
                href={firstLinkedLeg.matchHref}
                className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                比赛
                <ExternalLink className="size-3" />
              </Link>
            ) : null}
            {betSlipCount > 0 ? (
              <Link
                href={`/bets?q=${encodeURIComponent(intent.id)}`}
                className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                查看注单 {betSlipCount}
                <ExternalLink className="size-3" />
              </Link>
            ) : null}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2 text-sm md:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr]">
          <div>
            <div className="text-xs text-muted-foreground">选择</div>
            <div className="min-w-0 truncate">
              {legs[0]?.matchTitle ?? legs[0]?.matchText ?? "未关联比赛"}
              {legs[0] ? (
                <span className="text-muted-foreground">
                  {" · "}
                  {formatMarketLabel(legs[0].market)}
                  {" · "}
                  {legs[0].selection}
                  {legs[0].line ? ` ${legs[0].line}` : ""}
                </span>
              ) : null}
              {legs.length > 1 ? <span className="text-muted-foreground"> · +{legs.length - 1} legs</span> : null}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">金额 / 赔率</div>
            <div className="font-mono tabular-nums">{formatCny(intent.intendedStakeCents)} @ {intent.intendedTotalOdds.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">潜在返还</div>
            <div className="font-mono tabular-nums">{formatCny(potentialReturnCents)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">风险</div>
            <div>{formatRiskTierLabel(intent.riskTier)}</div>
          </div>
        </div>
        <div className="grid gap-2 text-xs text-muted-foreground md:grid-cols-4">
          <div>创建：{formatLocalMinute(intent.createdAt)}</div>
          <div>过期：{intent.expiresAt ? formatLocalMinute(intent.expiresAt) : "未设置"}</div>
          <div>尝试：{attemptCount} 次{failedAttemptCount > 0 ? ` / 失败 ${failedAttemptCount}` : ""}</div>
          <div>注单：{betSlipCount} 张</div>
        </div>
        <details className="group rounded-md border bg-muted/20 px-3 py-2">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-medium">
            展开理由、legs 和执行入口
            <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-3 space-y-3">
            {legs.length ? (
              <div className="space-y-1 rounded-md border bg-background px-3 py-2 text-sm">
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
          </div>
        </details>
      </CardContent>
    </Card>
  );
}
