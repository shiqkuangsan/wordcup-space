import Link from "next/link";
import { MatchForm } from "@/components/matches/match-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatLocalMinute } from "@/domain/dates";
import { formatMatchStage, formatMatchStatus } from "@/domain/match-sync";
import { formatMatchTitle } from "@/domain/team-names";
import { listMatches } from "@/server/queries/matches";

export const dynamic = "force-dynamic";

export default async function MatchesPage() {
  const matches = await listMatches();

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
      <Card>
        <CardHeader>
          <CardTitle>比赛中心</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>比赛</TableHead>
                <TableHead>阶段</TableHead>
                <TableHead>开球</TableHead>
                <TableHead>状态</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {matches.map((match) => (
                <TableRow key={match.id}>
                  <TableCell>
                    <Link href={`/matches/${match.id}`} className="font-medium hover:underline">
                      {formatMatchTitle(match.homeTeam, match.awayTeam)}
                    </Link>
                  </TableCell>
                  <TableCell>{formatMatchStage(match.stage)}</TableCell>
                  <TableCell className="font-mono text-xs tabular-nums">{formatLocalMinute(match.kickoffAt)}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{formatMatchStatus(match.status)}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <MatchForm />
    </div>
  );
}
