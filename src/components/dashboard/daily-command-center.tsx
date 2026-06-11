import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatLocalMinute } from "@/domain/dates";
import { formatDecisionByLabel, formatIntentStatus } from "@/domain/display-labels";
import { formatCny } from "@/domain/money";

type FocusMatch = {
  id: string;
  href: string;
  title: string;
  kickoffAt: string;
  status: string;
  oddsCount: number;
};

type MissingOddsMatch = {
  id: string;
  href: string;
  title: string;
  kickoffAt: string;
};

type PendingIntent = {
  id: string;
  decisionBy: string;
  stakeCents: number;
  odds: number;
  status: string;
};

type SettlementCandidate = {
  slipId: string;
  href: string;
  matchTitle: string;
  stakeCents: number;
  finalOdds: number;
};

export function DailyCommandCenter({
  dateKey,
  focusLabel,
  focusMatches,
  missingOdds,
  pendingIntents,
  settlementQueue,
}: {
  dateKey: string;
  focusLabel: string;
  focusMatches: FocusMatch[];
  missingOdds: MissingOddsMatch[];
  pendingIntents: PendingIntent[];
  settlementQueue: SettlementCandidate[];
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>每日作战台</CardTitle>
          <Badge variant="outline">{dateKey}</Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 xl:grid-cols-4">
        <section className="space-y-2">
          <div className="text-sm font-medium">{focusLabel}</div>
          {focusMatches.slice(0, 5).map((match) => (
            <Link key={match.id} href={match.href} className="block rounded-md border px-3 py-2 text-sm hover:bg-muted/40">
              <div className="font-medium">{match.title}</div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>{formatLocalMinute(match.kickoffAt)}</span>
                <span>{match.status}</span>
                <span>{match.oddsCount} odds</span>
              </div>
            </Link>
          ))}
          {focusMatches.length === 0 ? <p className="text-sm text-muted-foreground">暂无今日或后续比赛。</p> : null}
        </section>

        <section className="space-y-2">
          <div className="text-sm font-medium">缺盘口</div>
          {missingOdds.slice(0, 5).map((match) => (
            <Link key={match.id} href={match.href} className="block rounded-md border px-3 py-2 text-sm hover:bg-muted/40">
              <div className="font-medium">{match.title}</div>
              <div className="mt-1 text-xs text-muted-foreground">{formatLocalMinute(match.kickoffAt)}</div>
            </Link>
          ))}
          {missingOdds.length === 0 ? <p className="text-sm text-muted-foreground">近期比赛都有盘口。</p> : null}
        </section>

        <section className="space-y-2">
          <div className="text-sm font-medium">待执行</div>
          {pendingIntents.slice(0, 5).map((intent) => (
            <Link key={intent.id} href="/intents" className="block rounded-md border px-3 py-2 text-sm hover:bg-muted/40">
              <div className="flex items-center justify-between gap-2">
                <span>{formatDecisionByLabel(intent.decisionBy)}</span>
                <Badge variant="outline">{formatIntentStatus(intent.status)}</Badge>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                stake {formatCny(intent.stakeCents)} · odds {intent.odds.toFixed(2)}
              </div>
            </Link>
          ))}
          {pendingIntents.length === 0 ? <p className="text-sm text-muted-foreground">暂无待执行 intent。</p> : null}
        </section>

        <section className="space-y-2">
          <div className="text-sm font-medium">待结算</div>
          {settlementQueue.slice(0, 5).map((candidate) => (
            <Link key={candidate.slipId} href={candidate.href} className="block rounded-md border px-3 py-2 text-sm hover:bg-muted/40">
              <div className="font-medium">{candidate.matchTitle}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                stake {formatCny(candidate.stakeCents)} · odds {candidate.finalOdds.toFixed(2)}
              </div>
            </Link>
          ))}
          {settlementQueue.length === 0 ? <p className="text-sm text-muted-foreground">暂无待结算提示。</p> : null}
        </section>
      </CardContent>
    </Card>
  );
}
