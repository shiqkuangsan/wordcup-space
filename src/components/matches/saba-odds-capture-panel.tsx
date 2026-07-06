"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Database, RefreshCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Scope = "common" | "all";

type CaptureMatchSummary = {
  matchId: string;
  matchNumber: number | null;
  title: string;
  kickoffAt: string;
  sabaMarketCount: number | null;
  sabaTitle: string | null;
  homeAwayMismatch: boolean;
  skippedReason: string | null;
  parsedCount: number;
  completeness: {
    status: "complete" | "thin" | "empty";
    reason: string;
    marketCount: number;
    rowCount: number;
    markets: string[];
  };
  markets: string[];
};

type CaptureSummary = {
  dryRun: boolean;
  write: boolean;
  bookmaker: string;
  capturedAt: string;
  scope: Scope;
  inserted: number;
  totalRows: number;
  matches: CaptureMatchSummary[];
};

function tomorrowDateValue() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function defaultDelayForScope(scope: Scope) {
  return scope === "all" ? "750" : "250";
}

function completenessLabel(status: CaptureMatchSummary["completeness"]["status"]) {
  if (status === "complete") return "覆盖正常";
  if (status === "thin") return "盘口不完整";
  return "未抓到";
}

export function SabaOddsCapturePanel() {
  const router = useRouter();
  const [localDate, setLocalDate] = useState(tomorrowDateValue);
  const [scope, setScope] = useState<Scope>("common");
  const [requestDelayMs, setRequestDelayMs] = useState(defaultDelayForScope("common"));
  const [summary, setSummary] = useState<CaptureSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const parsedDelay = useMemo(() => {
    const value = Number(requestDelayMs);
    return Number.isFinite(value) && value >= 0 ? Math.floor(value) : undefined;
  }, [requestDelayMs]);

  function changeScope(nextScope: Scope) {
    setScope(nextScope);
    setRequestDelayMs(defaultDelayForScope(nextScope));
  }

  function runCapture(write: boolean) {
    startTransition(async () => {
      setError(null);
      try {
        const response = await fetch("/api/odds/saba-capture", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            localDate,
            scope,
            write,
            requestDelayMs: parsedDelay,
          }),
        });
        const payload = await response.json();
        if (!response.ok || !payload.ok) {
          throw new Error(payload.error ?? "沙巴盘口抓取失败");
        }
        setSummary(payload.data);
        if (write) router.refresh();
      } catch (captureError) {
        setError(captureError instanceof Error ? captureError.message : String(captureError));
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>沙巴盘口抓取</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="grid gap-3 sm:grid-cols-[1fr_130px_120px]">
          <label className="space-y-1.5">
            <span className="text-xs text-muted-foreground">比赛日期</span>
            <Input type="date" value={localDate} onChange={(event) => setLocalDate(event.target.value)} />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs text-muted-foreground">抓取范围</span>
            <Select value={scope} onValueChange={(value) => changeScope(value as Scope)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="common">常用盘口</SelectItem>
                <SelectItem value="all">全量盘口</SelectItem>
              </SelectContent>
            </Select>
          </label>
          <label className="space-y-1.5">
            <span className="text-xs text-muted-foreground">请求间隔 ms</span>
            <Input
              inputMode="numeric"
              min={0}
              type="number"
              value={requestDelayMs}
              onChange={(event) => setRequestDelayMs(event.target.value)}
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" disabled={isPending} onClick={() => runCapture(false)}>
            <RefreshCw className={isPending ? "animate-spin" : undefined} />
            先检查
          </Button>
          <Button type="button" size="sm" disabled={isPending} onClick={() => runCapture(true)}>
            <Database />
            写入快照
          </Button>
        </div>

        <p className="text-xs leading-5 text-muted-foreground">
          常用盘口用于日常决策和列表展示；全量盘口适合赛前归档，数量较大，建议保留请求间隔。
        </p>

        {error ? (
          <Alert variant="destructive">
            <AlertTriangle />
            <AlertTitle>抓取失败</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {summary ? (
          <div className="space-y-3">
            <Alert>
              <Database />
              <AlertTitle>{summary.write ? "写入完成" : "检查完成"}</AlertTitle>
              <AlertDescription>
                {summary.matches.length} 场比赛，解析 {summary.totalRows} 条盘口
                {summary.write ? `，已写入 ${summary.inserted} 条快照` : "，尚未写入数据库"}。
              </AlertDescription>
            </Alert>

            <div className="divide-y rounded-lg border">
              {summary.matches.map((match) => (
                <div key={match.matchId} className="space-y-2 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{match.title}</span>
                    {match.matchNumber ? <Badge variant="outline">#{match.matchNumber}</Badge> : null}
                    <Badge variant={match.skippedReason ? "destructive" : "secondary"}>
                      {match.skippedReason ? "跳过" : `${match.parsedCount} 条`}
                    </Badge>
                    <Badge variant={match.completeness.status === "complete" ? "secondary" : "destructive"}>
                      {completenessLabel(match.completeness.status)}
                    </Badge>
                    {match.homeAwayMismatch ? <Badge variant="outline">主客序不同</Badge> : null}
                  </div>
                  {match.sabaTitle && match.sabaTitle !== match.title ? (
                    <div className="text-xs text-muted-foreground">沙巴：{match.sabaTitle}</div>
                  ) : null}
                  {match.sabaMarketCount !== null ? (
                    <div className="text-xs text-muted-foreground">SABA MarketCount：{match.sabaMarketCount}</div>
                  ) : null}
                  {match.skippedReason ? (
                    <div className="text-xs text-destructive">{match.skippedReason}</div>
                  ) : match.completeness.status !== "complete" ? (
                    <div className="text-xs text-destructive">{match.completeness.reason}</div>
                  ) : (
                    <div className="line-clamp-2 text-xs text-muted-foreground">
                      {match.markets.length} 类盘口：{match.markets.join("、")}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
