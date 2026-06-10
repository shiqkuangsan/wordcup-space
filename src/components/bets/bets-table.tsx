import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatActorLabel, formatBetSlipStatus, formatDecisionByLabel } from "@/domain/display-labels";
import { formatCny } from "@/domain/money";
import type { betSlips } from "@/db/schema";

type Slip = typeof betSlips.$inferSelect;

export function BetsTable({ slips }: { slips: Slip[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>状态</TableHead>
          <TableHead>归属</TableHead>
          <TableHead>决策</TableHead>
          <TableHead>金额</TableHead>
          <TableHead>赔率</TableHead>
          <TableHead>真实资金</TableHead>
          <TableHead>确认</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {slips.map((slip) => (
          <TableRow key={slip.id}>
            <TableCell><Badge variant="outline">{formatBetSlipStatus(slip.status)}</Badge></TableCell>
            <TableCell>{formatActorLabel(slip.portfolioId)}</TableCell>
            <TableCell>{formatDecisionByLabel(slip.decisionBy)}</TableCell>
            <TableCell>{formatCny(slip.stakeCents)}</TableCell>
            <TableCell>{slip.finalOdds.toFixed(2)}</TableCell>
            <TableCell>{slip.isRealMoney ? "是" : "否"}</TableCell>
            <TableCell>{slip.confirmationRef}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
