import { eq } from "drizzle-orm";
import { OddsEntryForm } from "@/components/matches/odds-entry-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getDb } from "@/db/client";
import { betIntents, betSlips, executionAttempts, matches, oddsSnapshots } from "@/db/schema";
import { formatLocalMinute } from "@/domain/dates";
import { formatMatchTitle, formatTeamName } from "@/domain/team-names";

export const dynamic = "force-dynamic";

export default async function MatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const match = db.select().from(matches).where(eq(matches.id, id)).get();
  const odds = db.select().from(oddsSnapshots).where(eq(oddsSnapshots.matchId, id)).all();
  const intents = db.select().from(betIntents).all();
  const attempts = db.select().from(executionAttempts).all();
  const slips = db.select().from(betSlips).all();

  if (!match) return <div>比赛不存在。</div>;

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-sm text-muted-foreground">{match.stage}</p>
        <h2 className="text-2xl font-semibold tracking-normal">
          {formatMatchTitle(match.homeTeam, match.awayTeam)}
        </h2>
        <p className="text-sm text-muted-foreground">{formatLocalMinute(match.kickoffAt)}</p>
      </div>
      <OddsEntryForm matchId={match.id} />
      <Card>
        <CardHeader>
          <CardTitle>赔率快照</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>公司</TableHead>
                <TableHead>市场</TableHead>
                <TableHead>选择</TableHead>
                <TableHead>赔率</TableHead>
                <TableHead>来源</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {odds.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.bookmaker}</TableCell>
                  <TableCell>{row.market}</TableCell>
                  <TableCell>{formatTeamName(row.selection)}</TableCell>
                  <TableCell>{row.decimalOdds.toFixed(2)}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{row.sourceType}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>决策</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">{intents.length} 条 intent</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>执行</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">{attempts.length} 次 attempt</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>注单</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">{slips.length} 张 slip</CardContent>
        </Card>
      </div>
    </div>
  );
}
