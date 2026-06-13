import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatLocalMinute } from "@/domain/dates";
import { formatActorLabel, formatBetSlipStatus, formatDecisionByLabel } from "@/domain/display-labels";
import { formatCny } from "@/domain/money";
import { formatOddsWithFormat } from "@/domain/odds";
import { cn } from "@/lib/utils";
import type { betSlips } from "@/db/schema";

type Slip = typeof betSlips.$inferSelect & {
  matchSummary?: string;
  matchLinks?: Array<{ title: string; href?: string }>;
  selectionSummary?: string;
};

function getStatusTone(status: string) {
  if (status === "won" || status === "half_won") return "win";
  if (status === "lost" || status === "half_lost") return "loss";
  if (status === "cashout" || status === "void") return "neutral";
  if (status === "cancelled") return "cancelled";
  return "open";
}

function StatusBadge({ status }: { status: string }) {
  const tone = getStatusTone(status);
  return (
    <Badge
      variant="outline"
      className={cn(
        "h-6 rounded-md px-2 text-xs font-semibold",
        tone === "win" && "border-emerald-500/40 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
        tone === "loss" && "border-red-500/40 bg-red-500/12 text-red-700 dark:text-red-300",
        tone === "neutral" && "border-sky-500/40 bg-sky-500/12 text-sky-700 dark:text-sky-300",
        tone === "cancelled" && "border-muted-foreground/30 bg-muted text-muted-foreground",
      )}
    >
      {formatBetSlipStatus(status)}
    </Badge>
  );
}

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
        {slips.map((slip) => {
          const tone = getStatusTone(slip.status);
          return (
            <TableRow
              key={slip.id}
              className={cn(
                tone === "win" && "bg-emerald-500/[0.06] hover:bg-emerald-500/[0.09]",
                tone === "loss" && "bg-red-500/[0.06] hover:bg-red-500/[0.09]",
                tone === "neutral" && "bg-sky-500/[0.05] hover:bg-sky-500/[0.08]",
              )}
            >
              <TableCell><StatusBadge status={slip.status} /></TableCell>
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
          );
        })}
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
