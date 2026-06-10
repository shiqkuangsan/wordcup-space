import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatLocalMinute } from "@/domain/dates";
import { formatActorLabel, formatBetModeLabel } from "@/domain/display-labels";
import { formatCny } from "@/domain/money";
import type { betSlips } from "@/db/schema";

type Slip = typeof betSlips.$inferSelect;

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
              <TableHead>组合</TableHead>
              <TableHead>归属</TableHead>
              <TableHead>金额</TableHead>
              <TableHead>潜在返还</TableHead>
              <TableHead>时间</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {slips.map((slip) => (
              <TableRow key={slip.id}>
                <TableCell>{formatBetModeLabel(slip.mode)}</TableCell>
                <TableCell>{formatActorLabel(slip.portfolioId)}</TableCell>
                <TableCell>{formatCny(slip.stakeCents)}</TableCell>
                <TableCell>{formatCny(slip.potentialReturnCents)}</TableCell>
                <TableCell className="font-mono text-xs tabular-nums">{formatLocalMinute(slip.placedAt)}</TableCell>
              </TableRow>
            ))}
            {slips.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground">
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
