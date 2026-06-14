import Link from "next/link";
import { AlertTriangle, CheckCircle2, ChevronDown, CircleSlash, Clock, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IntentClosePanel } from "@/components/intents/intent-close-panel";
import { IntentExecutionPanel } from "@/components/intents/intent-execution-panel";
import { getEffectiveIntentStatus, isIntentExecutable } from "@/domain/bet-lifecycle";
import { formatMarketLabel } from "@/domain/betting-markets";
import { formatLocalMinute } from "@/domain/dates";
import { formatBetModeLabel, formatDecisionByLabel, formatIntentStatus, formatRiskTierLabel } from "@/domain/display-labels";
import { formatCny } from "@/domain/money";
import { cn } from "@/lib/utils";
import type { betIntentLegs, betIntents, platformAccounts } from "@/db/schema";

type Intent = typeof betIntents.$inferSelect;
type IntentLeg = typeof betIntentLegs.$inferSelect & {
  matchHref?: string;
  matchTitle?: string;
};
type PlatformAccount = typeof platformAccounts.$inferSelect;

function getCardTone(effectiveStatus: string, hasSlip: boolean, canAct: boolean) {
  if (hasSlip) return "border-emerald-500/30 bg-emerald-500/[0.04]";
  if (canAct) return "border-primary/40 bg-primary/[0.035]";
  if (effectiveStatus === "expired") return "border-amber-500/35 bg-amber-500/[0.045]";
  if (effectiveStatus === "cancelled") return "border-muted-foreground/20 bg-muted/20";
  return undefined;
}

function formatLegSummary(leg: IntentLeg) {
  return `${formatMarketLabel(leg.market)} · ${leg.selection}${leg.line ? ` ${leg.line}` : ""}`;
}

function renderActionIcon(effectiveStatus: string, hasSlip: boolean, canAct: boolean) {
  if (hasSlip) return <CheckCircle2 className="size-3" />;
  if (canAct) return <Clock className="size-3" />;
  if (effectiveStatus === "expired") return <AlertTriangle className="size-3" />;
  return <CircleSlash className="size-3" />;
}

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
  const canCloseWithoutSlip = betSlipCount === 0 && !["executed", "cancelled", "expired"].includes(intent.status);
  const canExecute = betSlipCount === 0 && isIntentExecutable(intent, now);
  const canAct = canExecute || canCloseWithoutSlip;
  const hasSlip = betSlipCount > 0;
  const defaultCloseReason = failedAttemptCount > 0 ? "execution_failed" : effectiveStatus === "expired" ? "expired_not_adopted" : "user_cancelled";
  const potentialReturnCents = Math.round(intent.intendedStakeCents * intent.intendedTotalOdds);
  const firstLinkedLeg = legs.find((leg) => leg.matchHref);
  const firstLeg = legs[0];

  return (
    <Card
      size="sm"
      className={cn(
        "rounded-lg",
        getCardTone(effectiveStatus, hasSlip, canAct),
        isStatusCorrected && "ring-1 ring-amber-500/30",
      )}
    >
      <CardHeader className="border-b">
        <CardTitle className="grid min-w-0 gap-3 text-sm lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={canAct ? "default" : "outline"} className="gap-1">
                {renderActionIcon(effectiveStatus, hasSlip, canAct)}
                {actionHint ?? formatIntentStatus(effectiveStatus)}
              </Badge>
              <Badge variant="outline">{formatDecisionByLabel(intent.decisionBy)}</Badge>
              <Badge variant="outline">{formatBetModeLabel(intent.mode)}</Badge>
              <Badge variant={effectiveStatus === "expired" ? "destructive" : "outline"}>
                {formatIntentStatus(effectiveStatus)}
              </Badge>
              {isStatusCorrected ? <Badge variant="outline">状态待归档</Badge> : null}
            </div>
            <div className="min-w-0">
              <div className="truncate text-base font-semibold">
                {firstLeg?.matchTitle ?? firstLeg?.matchText ?? "未关联比赛"}
              </div>
              <div className="mt-1 truncate text-sm font-normal text-muted-foreground">
                {firstLeg ? formatLegSummary(firstLeg) : "未记录选择"}
                {legs.length > 1 ? ` · +${legs.length - 1} legs` : ""}
              </div>
            </div>
          </div>
          <div className="grid min-w-[220px] grid-cols-3 gap-2 text-right">
            <div>
              <div className="text-xs font-normal text-muted-foreground">金额</div>
              <div className="font-mono text-base tabular-nums">{formatCny(intent.intendedStakeCents)}</div>
            </div>
            <div>
              <div className="text-xs font-normal text-muted-foreground">赔率</div>
              <div className="font-mono text-base tabular-nums">{intent.intendedTotalOdds.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-xs font-normal text-muted-foreground">返还</div>
              <div className="font-mono text-base tabular-nums">{formatCny(potentialReturnCents)}</div>
            </div>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>创建：{formatLocalMinute(intent.createdAt)}</span>
            <span>过期：{intent.expiresAt ? formatLocalMinute(intent.expiresAt) : "未设置"}</span>
            <span>风险：{formatRiskTierLabel(intent.riskTier)}</span>
            <span>尝试：{attemptCount}{failedAttemptCount > 0 ? ` / 失败 ${failedAttemptCount}` : ""}</span>
            <span>注单：{betSlipCount}</span>
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
        </div>
        {canExecute || canCloseWithoutSlip ? (
          <div className="grid gap-3 rounded-md border bg-background p-3 xl:grid-cols-[minmax(0,1fr)_minmax(280px,0.7fr)]">
            {canExecute ? <IntentExecutionPanel intent={intent} platformAccounts={platformAccounts} /> : null}
            {canCloseWithoutSlip ? <IntentClosePanel intentId={intent.id} defaultReason={defaultCloseReason} /> : null}
          </div>
        ) : null}
        <details className="group rounded-md border bg-muted/20 px-3 py-2">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-medium">
            理由、legs 和审计信息
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
                      <span className="text-muted-foreground">{" · "}{formatLegSummary(leg)}</span>
                    </div>
                    <span className="font-mono text-xs text-muted-foreground">{leg.intendedOdds.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            ) : null}
            <p className="text-sm text-muted-foreground">{intent.rationale}</p>
            <div className="rounded-md border bg-background px-3 py-2 font-mono text-xs text-muted-foreground">
              {intent.id}
            </div>
          </div>
        </details>
      </CardContent>
    </Card>
  );
}
