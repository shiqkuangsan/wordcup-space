import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatLocalMinute } from "@/domain/dates";
import { formatActorLabel } from "@/domain/display-labels";
import { formatLedgerEntryType } from "@/domain/ledger";
import { formatCny } from "@/domain/money";
import type { portfolioLedgerEntries } from "@/db/schema";

type Entry = typeof portfolioLedgerEntries.$inferSelect;

export function LedgerTable({ entries }: { entries: Entry[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>时间</TableHead>
          <TableHead>账本</TableHead>
          <TableHead>类型</TableHead>
          <TableHead>金额</TableHead>
          <TableHead>余额</TableHead>
          <TableHead>备注</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry) => (
          <TableRow key={entry.id}>
            <TableCell className="font-mono text-xs tabular-nums">{formatLocalMinute(entry.createdAt)}</TableCell>
            <TableCell>{formatActorLabel(entry.portfolioId)}</TableCell>
            <TableCell>{formatLedgerEntryType(entry.entryType)}</TableCell>
            <TableCell>{formatCny(entry.amountCents)}</TableCell>
            <TableCell>{formatCny(entry.balanceAfterCents)}</TableCell>
            <TableCell>{entry.notes}</TableCell>
          </TableRow>
        ))}
        {entries.length === 0 ? (
          <TableRow>
            <TableCell colSpan={6} className="text-muted-foreground">
              暂无资金流水。
            </TableCell>
          </TableRow>
        ) : null}
      </TableBody>
    </Table>
  );
}
