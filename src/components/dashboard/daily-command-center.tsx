import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatLocalMinute } from "@/domain/dates";
import { formatDecisionByLabel, formatIntentStatus } from "@/domain/display-labels";
import { formatCny } from "@/domain/money";
import { formatTeamName, getTeamFlag } from "@/domain/team-names";

type FocusMatch = {
  id: string;
  href: string;
  title: string;
  homeTeam: string;
  awayTeam: string;
  kickoffAt: string;
  status: string;
  oddsCount: number;
};

type MissingOddsMatch = {
  id: string;
  href: string;
  title: string;
  homeTeam: string;
  awayTeam: string;
  kickoffAt: string;
  reason: string;
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
  homeTeam: string;
  awayTeam: string;
  stakeCents: number;
  finalOdds: number;
};

function MatchTitle({
  homeTeam,
  awayTeam,
}: {
  homeTeam: string;
  awayTeam: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-1.5 font-medium">
      <span className="shrink-0" aria-hidden="true">
        {getTeamFlag(homeTeam)}
      </span>
      <span className="truncate">{formatTeamName(homeTeam)}</span>
      <span className="shrink-0 text-xs text-muted-foreground">vs</span>
      <span className="shrink-0" aria-hidden="true">
        {getTeamFlag(awayTeam)}
      </span>
      <span className="truncate">{formatTeamName(awayTeam)}</span>
    </div>
  );
}

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
              <MatchTitle homeTeam={match.homeTeam} awayTeam={match.awayTeam} />
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>{formatLocalMinute(match.kickoffAt)}</span>
                <span>{match.status}</span>
                {match.oddsCount > 0 ? <span>已录 {match.oddsCount} odds</span> : null}
              </div>
            </Link>
          ))}
          {focusMatches.length === 0 ? <p className="text-sm text-muted-foreground">暂无今日或后续比赛。</p> : null}
        </section>

        <section className="space-y-2">
          <div>
            <div className="text-sm font-medium">重点待补盘口</div>
            <p className="text-xs text-muted-foreground">只列今日或已有 intent 的比赛。</p>
          </div>
          {missingOdds.slice(0, 5).map((match) => (
            <Link key={match.id} href={match.href} className="block rounded-md border px-3 py-2 text-sm hover:bg-muted/40">
              <MatchTitle homeTeam={match.homeTeam} awayTeam={match.awayTeam} />
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>{formatLocalMinute(match.kickoffAt)}</span>
                <span>{match.reason}</span>
              </div>
            </Link>
          ))}
          {missingOdds.length === 0 ? (
            <p className="text-sm text-muted-foreground">没有必须马上补的盘口；准备分析或下注时再录即可。</p>
          ) : null}
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
              <MatchTitle homeTeam={candidate.homeTeam} awayTeam={candidate.awayTeam} />
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
