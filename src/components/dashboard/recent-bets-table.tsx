import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatLocalMinute } from "@/domain/dates";
import { formatActorLabel, formatBetModeLabel } from "@/domain/display-labels";
import { formatCny } from "@/domain/money";
import type { betSlips } from "@/db/schema";

type Slip = typeof betSlips.$inferSelect & {
  matchSummary?: string;
  matchLinks?: Array<{ title: string; href?: string }>;
  selectionSummary?: string;
};

export function RecentBetsTable({ slips }: { slips: Slip[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>最近注单</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>注单</TableHead>
              <TableHead>比赛</TableHead>
              <TableHead>归属</TableHead>
              <TableHead>金额</TableHead>
              <TableHead>潜在返还</TableHead>
              <TableHead>时间</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {slips.map((slip) => (
              <TableRow key={slip.id}>
                <TableCell>
                  <Link
                    href={`/bets?q=${encodeURIComponent(slip.id)}`}
                    className="font-medium text-foreground underline-offset-4 hover:underline"
                  >
                    {formatBetModeLabel(slip.mode)}
                  </Link>
                  <div className="font-mono text-[11px] text-muted-foreground">{slip.id}</div>
                </TableCell>
                <TableCell>
                  {slip.matchLinks?.length ? (
                    <div className="space-y-1">
                      {slip.matchLinks.map((match) => (
                        match.href ? (
                          <Link
                            key={`${match.href}-${match.title}`}
                            href={match.href}
                            className="block text-foreground underline-offset-4 hover:underline"
                          >
                            {match.title}
                          </Link>
                        ) : (
                          <span key={match.title} className="block">{match.title}</span>
                        )
                      ))}
                      <div className="text-xs text-muted-foreground">{slip.selectionSummary ?? "未记录选择"}</div>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">{slip.matchSummary ?? "未关联比赛"}</span>
                  )}
                </TableCell>
                <TableCell>{formatActorLabel(slip.portfolioId)}</TableCell>
                <TableCell>{formatCny(slip.stakeCents)}</TableCell>
                <TableCell>{formatCny(slip.potentialReturnCents)}</TableCell>
                <TableCell className="font-mono text-xs tabular-nums">{formatLocalMinute(slip.placedAt)}</TableCell>
              </TableRow>
            ))}
            {slips.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground">
                  暂无成交注单。
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
