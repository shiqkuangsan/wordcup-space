import Link from "next/link";
import { eq } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDb } from "@/db/client";
import { betIntentLegs, betIntents, betSlipLegs, betSlips, executionAttempts, matches } from "@/db/schema";
import { formatLocalMinute } from "@/domain/dates";
import { formatMatchStage, formatMatchStatus } from "@/domain/match-sync";
import { formatMatchTitle } from "@/domain/team-names";

export const dynamic = "force-dynamic";

export default async function MatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const match = db.select().from(matches).where(eq(matches.id, id)).get();
  const intentLegs = db.select().from(betIntentLegs).where(eq(betIntentLegs.matchId, id)).all();
  const slipLegs = db.select().from(betSlipLegs).where(eq(betSlipLegs.matchId, id)).all();
  const intentIds = new Set(intentLegs.map((leg) => leg.betIntentId));
  const slipIds = new Set(slipLegs.map((leg) => leg.betSlipId));
  const intents = db.select().from(betIntents).all().filter((intent) => intentIds.has(intent.id));
  const attempts = db.select().from(executionAttempts).all().filter((attempt) => intentIds.has(attempt.betIntentId));
  const slips = db.select().from(betSlips).all().filter((slip) => slipIds.has(slip.id));

  if (!match) return <div>比赛不存在。</div>;

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-sm text-muted-foreground">{formatMatchStage(match.stage)}</p>
        <h2 className="text-2xl font-semibold tracking-normal">
          {formatMatchTitle(match.homeTeam, match.awayTeam)}
        </h2>
        <p className="text-sm text-muted-foreground">
          {formatLocalMinute(match.kickoffAt)}
          {match.venue ? ` · ${match.venue}` : ""}
          {match.groupName ? ` · ${match.groupName} 组` : ""}
          {` · ${formatMatchStatus(match.status)}`}
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Link href={`/intents?matchId=${encodeURIComponent(id)}`} className="block">
          <Card className="transition-colors hover:border-foreground/40 hover:bg-muted/40">
            <CardHeader><CardTitle>决策</CardTitle></CardHeader>
            <CardContent className="text-sm text-muted-foreground">{intents.length} 条 intent</CardContent>
          </Card>
        </Link>
        <Link href={`/intents?matchId=${encodeURIComponent(id)}&view=attempts`} className="block">
          <Card className="transition-colors hover:border-foreground/40 hover:bg-muted/40">
            <CardHeader><CardTitle>执行</CardTitle></CardHeader>
            <CardContent className="text-sm text-muted-foreground">{attempts.length} 次 attempt</CardContent>
          </Card>
        </Link>
        <Link href={`/bets?matchId=${encodeURIComponent(id)}`} className="block">
          <Card className="transition-colors hover:border-foreground/40 hover:bg-muted/40">
            <CardHeader><CardTitle>注单</CardTitle></CardHeader>
            <CardContent className="text-sm text-muted-foreground">{slips.length} 张 slip</CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
