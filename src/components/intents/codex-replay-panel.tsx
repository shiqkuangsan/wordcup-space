import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMarketLabel } from "@/domain/betting-markets";
import { formatLocalMinute } from "@/domain/dates";
import { formatCny } from "@/domain/money";
import type { CodexReplayExecutionStatus, CodexReplaySummary } from "@/server/queries/codex-replay";

function signedCny(cents: number | null) {
  if (cents === null) return "-";
  const sign = cents > 0 ? "+" : "";
  return `${sign}${formatCny(cents)}`;
}

function pct(value: number | null) {
  return value === null ? "-" : `${(value * 100).toFixed(1)}%`;
}

function executionLabel(status: CodexReplayExecutionStatus) {
  switch (status) {
    case "placed":
      return "已成功下注";
    case "execution_failed":
      return "下注未成功";
    case "not_adopted":
      return "未采纳";
    case "pending_execution":
      return "待执行";
  }
}

function theoreticalStatusLabel(status: CodexReplaySummary["rows"][number]["theoreticalStatus"]) {
  switch (status) {
    case "settled":
      return "已可复盘";
    case "pending_result":
      return "等赛果";
    case "missing_result":
      return "缺赛果";
    case "unsupported_market":
      return "暂不支持";
  }
}

function SummaryCell({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-md border bg-background px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-xl tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground">{detail}</div>
    </div>
  );
}

export function CodexReplayPanel({ replay }: { replay: CodexReplaySummary }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-2">
          <span>Codex 理论账本 vs 实际盈亏</span>
          <Badge variant="outline">只读复盘，不改资金</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-4">
          <SummaryCell
            label="理论 Codex"
            value={signedCny(replay.theoretical.profitLossCents)}
            detail={`${replay.theoretical.settledCount} 条可复盘 · ROI ${pct(replay.theoretical.roi)}`}
          />
          <SummaryCell
            label="实际 Codex"
            value={signedCny(replay.actualCodex.profitLossCents)}
            detail={`${replay.actualCodex.settledCount} 张已结算 · ROI ${pct(replay.actualCodex.roi)}`}
          />
          <SummaryCell
            label="实际总账"
            value={signedCny(replay.actualAll.profitLossCents)}
            detail={`${replay.actualAll.settledCount} 张已结算 · ROI ${pct(replay.actualAll.roi)}`}
          />
          <SummaryCell
            label="理论差额"
            value={signedCny(replay.deltaVsActualAllCents)}
            detail={`相对当前实际总账；Codex差 ${signedCny(replay.deltaVsActualCodexCents)}`}
          />
        </div>

        <div className="grid gap-2 text-sm md:grid-cols-4">
          <div className="rounded-md border px-3 py-2">成功下注：{replay.execution.placedCount}</div>
          <div className="rounded-md border px-3 py-2">未采纳：{replay.execution.notAdoptedCount}</div>
          <div className="rounded-md border px-3 py-2">下注未成功：{replay.execution.failedCount}</div>
          <div className="rounded-md border px-3 py-2">等待操作/赛果：{replay.execution.pendingCount + replay.theoretical.pendingCount}</div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="py-2 pr-3 font-medium">决策</th>
                <th className="py-2 pr-3 font-medium">执行</th>
                <th className="py-2 pr-3 font-medium">理论结算</th>
                <th className="py-2 pr-3 font-medium">理论盈亏</th>
                <th className="py-2 pr-3 font-medium">实际盈亏</th>
              </tr>
            </thead>
            <tbody>
              {replay.rows.slice(0, 8).map((row) => (
                <tr key={row.intentId} className="border-t align-top">
                  <td className="py-2 pr-3">
                    <div className="font-medium">
                      {row.matchHref ? (
                        <Link href={row.matchHref} className="underline-offset-4 hover:underline">
                          {row.matchTitle}
                        </Link>
                      ) : (
                        row.matchTitle
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatLocalMinute(row.createdAt)} · {formatMarketLabel(row.market)} · {row.selection}
                      {row.line ? ` ${row.line}` : ""} · {formatCny(row.stakeCents)} @ {row.odds.toFixed(2)}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Link href={`/intents?q=${encodeURIComponent(row.intentId)}`} className="font-mono text-xs text-muted-foreground underline-offset-4 hover:underline">
                        {row.intentId}
                      </Link>
                      {row.actualSlipId ? (
                        <Link href={`/bets?q=${encodeURIComponent(row.actualSlipId)}`} className="text-xs text-muted-foreground underline-offset-4 hover:underline">
                          注单
                        </Link>
                      ) : null}
                    </div>
                  </td>
                  <td className="py-2 pr-3">
                    <Badge variant={row.executionStatus === "placed" ? "default" : "outline"}>
                      {executionLabel(row.executionStatus)}
                    </Badge>
                  </td>
                  <td className="py-2 pr-3">
                    <div>{theoreticalStatusLabel(row.theoreticalStatus)}</div>
                    <div className="text-xs text-muted-foreground">
                      {row.theoreticalResult ?? row.theoreticalReason ?? "-"}
                    </div>
                  </td>
                  <td className="py-2 pr-3 font-mono tabular-nums">{signedCny(row.theoreticalProfitLossCents)}</td>
                  <td className="py-2 pr-3 font-mono tabular-nums">{signedCny(row.actualProfitLossCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {replay.rows.length === 0 ? <p className="text-sm text-muted-foreground">暂无 Codex 决策。</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}
