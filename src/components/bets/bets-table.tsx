import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatLocalMinute } from "@/domain/dates";
import { formatActorLabel, formatBetSlipStatus, formatDecisionByLabel } from "@/domain/display-labels";
import { formatCny } from "@/domain/money";
import { formatOddsWithFormat } from "@/domain/odds";
import type { betSlips } from "@/db/schema";

type Slip = typeof betSlips.$inferSelect & {
  matchSummary?: string;
  matchLinks?: Array<{ title: string; href?: string }>;
  selectionSummary?: string;
};

export function BetsTable({ slips, emptyText }: { slips: Slip[]; emptyText: string }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>状态</TableHead>
          <TableHead>归属</TableHead>
          <TableHead>决策</TableHead>
          <TableHead>比赛</TableHead>
          <TableHead>选择</TableHead>
          <TableHead>组合</TableHead>
          <TableHead>金额</TableHead>
          <TableHead>赔率</TableHead>
          <TableHead>最高返还</TableHead>
          <TableHead>真实资金</TableHead>
          <TableHead>确认</TableHead>
          <TableHead>时间</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {slips.map((slip) => (
          <TableRow key={slip.id}>
            <TableCell><Badge variant="outline">{formatBetSlipStatus(slip.status)}</Badge></TableCell>
            <TableCell>{formatActorLabel(slip.portfolioId)}</TableCell>
            <TableCell>
              <Link
                href={`/intents?q=${encodeURIComponent(slip.betIntentId)}`}
                className="text-foreground underline-offset-4 hover:underline"
              >
                {formatDecisionByLabel(slip.decisionBy)}
              </Link>
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
                </div>
              ) : (
                slip.matchSummary ?? "未关联比赛"
              )}
            </TableCell>
            <TableCell>{slip.selectionSummary ?? "未记录选择"}</TableCell>
            <TableCell>{slip.mode === "parlay" ? "串关" : "单场"}</TableCell>
            <TableCell>{formatCny(slip.stakeCents)}</TableCell>
            <TableCell>{formatOddsWithFormat(slip.finalOdds, slip.rawOdds, slip.oddsFormat)}</TableCell>
            <TableCell>{formatCny(slip.potentialReturnCents)}</TableCell>
            <TableCell>{slip.isRealMoney ? "是" : "否"}</TableCell>
            <TableCell>{slip.confirmationRef || "无"}</TableCell>
            <TableCell className="font-mono text-xs tabular-nums">
              {formatLocalMinute(slip.settledAt ?? slip.placedAt)}
            </TableCell>
          </TableRow>
        ))}
        {slips.length === 0 ? (
          <TableRow>
            <TableCell colSpan={12} className="text-muted-foreground">
              {emptyText}
            </TableCell>
          </TableRow>
        ) : null}
      </TableBody>
    </Table>
  );
}
