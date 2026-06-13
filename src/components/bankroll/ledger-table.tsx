import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatLocalMinute } from "@/domain/dates";
import { formatActorLabel } from "@/domain/display-labels";
import { formatLedgerEntryType, getLedgerSignedAmount, type LedgerEntryType } from "@/domain/ledger";
import { formatCny } from "@/domain/money";
import { cn } from "@/lib/utils";
import type { portfolioLedgerEntries } from "@/db/schema";

type Entry = typeof portfolioLedgerEntries.$inferSelect;

const positiveTypes = new Set(["allocation_initial", "allocation_top_up", "settlement_win", "settlement_half_win", "cashout"]);
const negativeTypes = new Set(["allocation_withdrawal", "stake_paid", "settlement_loss", "settlement_half_loss"]);

function getEntryTone(entryType: string) {
  if (["settlement_win", "settlement_half_win"].includes(entryType)) return "win";
  if (["settlement_loss", "settlement_half_loss"].includes(entryType)) return "loss";
  if (entryType === "cashout" || entryType === "settlement_void") return "neutral";
  if (entryType === "stake_paid" || entryType === "allocation_withdrawal") return "outflow";
  if (positiveTypes.has(entryType)) return "inflow";
  return "neutral";
}

function formatSignedCny(entry: Entry) {
  const signedAmount = getLedgerSignedAmount(entry.entryType as LedgerEntryType, entry.amountCents);
  const prefix = signedAmount > 0 ? "+" : signedAmount < 0 ? "-" : "";
  return `${prefix}${formatCny(Math.abs(signedAmount))}`;
}

function getAmountHint(entryType: string) {
  switch (entryType) {
    case "settlement_win":
      return "返还";
    case "settlement_loss":
      return "无返还";
    case "settlement_half_win":
      return "半赢返还";
    case "settlement_half_loss":
      return "半输返还";
    case "stake_paid":
      return "下注支出";
    case "allocation_withdrawal":
      return "资金调出";
    case "allocation_top_up":
      return "资金调入";
    case "cashout":
      return "提前兑现";
    default:
      return null;
  }
}

function TypeBadge({ entryType }: { entryType: string }) {
  const tone = getEntryTone(entryType);
  return (
    <Badge
      variant="outline"
      className={cn(
        "h-6 rounded-md px-2 text-xs font-semibold",
        tone === "win" && "border-emerald-500/40 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
        tone === "loss" && "border-red-500/40 bg-red-500/12 text-red-700 dark:text-red-300",
        tone === "outflow" && "border-amber-500/40 bg-amber-500/12 text-amber-700 dark:text-amber-300",
        tone === "inflow" && "border-sky-500/40 bg-sky-500/12 text-sky-700 dark:text-sky-300",
      )}
    >
      {formatLedgerEntryType(entryType)}
    </Badge>
  );
}

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
        {entries.map((entry) => {
          const tone = getEntryTone(entry.entryType);
          const hint = getAmountHint(entry.entryType);
          return (
            <TableRow
              key={entry.id}
              className={cn(
                tone === "win" && "bg-emerald-500/[0.06] hover:bg-emerald-500/[0.09]",
                tone === "loss" && "bg-red-500/[0.06] hover:bg-red-500/[0.09]",
              )}
            >
              <TableCell className="font-mono text-xs tabular-nums">{formatLocalMinute(entry.createdAt)}</TableCell>
              <TableCell>{formatActorLabel(entry.portfolioId)}</TableCell>
              <TableCell><TypeBadge entryType={entry.entryType} /></TableCell>
              <TableCell>
                <div
                  className={cn(
                    "font-mono font-semibold tabular-nums",
                    tone === "win" && "text-emerald-700 dark:text-emerald-300",
                    tone === "loss" && "text-red-700 dark:text-red-300",
                    tone === "outflow" && "text-amber-700 dark:text-amber-300",
                    tone === "inflow" && "text-sky-700 dark:text-sky-300",
                  )}
                >
                  {formatSignedCny(entry)}
                </div>
                {hint ? <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div> : null}
              </TableCell>
              <TableCell className="font-mono tabular-nums">{formatCny(entry.balanceAfterCents)}</TableCell>
              <TableCell className="max-w-[520px] truncate">{entry.notes}</TableCell>
            </TableRow>
          );
        })}
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
