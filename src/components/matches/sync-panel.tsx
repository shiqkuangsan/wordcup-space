"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatLocalMinute } from "@/domain/dates";

type SourceSummary = {
  sourceName: string;
  count: number;
  lastSyncedAt?: string | null;
};

type SyncResponse = {
  sourceName: string;
  created: number;
  updated: number;
  total?: number;
  matchIds?: string[];
  warnings?: string[];
};

const syncTargets = [
  {
    label: "同步 104 场",
    description: "worldcup2026 API",
    endpoint: "/api/matches/sync/worldcup2026-api",
  },
  {
    label: "同步小组赛",
    description: "OpenFootball",
    endpoint: "/api/matches/sync/openfootball",
  },
];

export function MatchSyncPanel({
  summaries,
  visibleSource,
}: {
  summaries: SourceSummary[];
  visibleSource: string;
}) {
  const router = useRouter();
  const [isSyncing, setIsSyncing] = useState<string | null>(null);
  const [result, setResult] = useState<SyncResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function sync(endpoint: string) {
    setIsSyncing(endpoint);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(endpoint, { method: "POST" });
      const payload = await response.json();
      if (!response.ok || payload.ok === false) {
        throw new Error(typeof payload.error === "string" ? payload.error : (payload.error?.message ?? payload.message ?? "同步失败"));
      }

      setResult(payload.data ?? payload);
      router.refresh();
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : "同步失败");
    } finally {
      setIsSyncing(null);
    }
  }

  return (
    <Card>
      <CardHeader className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="size-5" />
            数据同步
          </CardTitle>
          <Badge variant="outline">当前显示 {visibleSource}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          {syncTargets.map((target) => (
            <Button
              key={target.endpoint}
              type="button"
              variant="outline"
              className="h-auto justify-between gap-3 px-3 py-2"
              disabled={Boolean(isSyncing)}
              onClick={() => sync(target.endpoint)}
            >
              <span className="text-left">
                <span className="block font-medium">{target.label}</span>
                <span className="block text-xs text-muted-foreground">{target.description}</span>
              </span>
              <RefreshCw className={`size-4 ${isSyncing === target.endpoint ? "animate-spin" : ""}`} />
            </Button>
          ))}
        </div>

        <div className="grid gap-2 md:grid-cols-3">
          {summaries.map((summary) => (
            <div key={summary.sourceName} className="rounded-md border px-3 py-2">
              <div className="text-sm font-medium">{summary.sourceName}</div>
              <div className="text-xs text-muted-foreground">
                {summary.count} 场 · {summary.lastSyncedAt ? formatLocalMinute(summary.lastSyncedAt) : "暂无同步时间"}
              </div>
            </div>
          ))}
        </div>

        {result ? (
          <Alert>
            <AlertTitle>同步完成</AlertTitle>
            <AlertDescription>
              {result.sourceName}: created {result.created}, updated {result.updated}, total{" "}
              {result.total ?? result.matchIds?.length ?? 0}
              {result.warnings?.length ? `, warnings ${result.warnings.length}` : ""}
            </AlertDescription>
          </Alert>
        ) : null}

        {error ? (
          <Alert variant="destructive">
            <AlertTitle>同步失败</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  );
}
