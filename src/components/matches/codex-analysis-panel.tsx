"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type OddsOption = {
  id: string;
  bookmaker: string;
  market: string;
  selection: string;
  line: string | null;
  decimalOdds: number;
  capturedAt: string;
};

type PreviewResult = {
  dryRun: boolean;
  writes: boolean;
  analysis: {
    recommendation: "bet" | "pass" | "wait";
    dataQuality: string;
    market: string;
    bookmaker: string;
    selection: string;
    decimalOdds: number;
    marketImpliedProbability: number;
    marketFairProbability: number;
    fairOdds: number;
    modelProbability?: number;
    expectedValue?: number;
    riskTier: string;
    confidence: string;
    stakeCents: number;
    rationale: string[];
  };
  intentPreview: {
    writes: boolean;
    intent: {
      intendedStakeCents: number;
      intendedTotalOdds: number;
      status: string;
      approvalMode: string;
    };
  };
  warnings: string[];
};

function pct(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function recommendationLabel(value: PreviewResult["analysis"]["recommendation"]) {
  if (value === "bet") return "可进入执行候选";
  if (value === "pass") return "放弃";
  return "等待";
}

export function CodexAnalysisPanel({
  matchId,
  oddsOptions,
}: {
  matchId: string;
  oddsOptions: OddsOption[];
}) {
  const [result, setResult] = useState<PreviewResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const defaultOddsId = oddsOptions[0]?.id ?? "";
  const selectedOptions = useMemo(() => oddsOptions.slice(0, 24), [oddsOptions]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const modelProbabilityPct = Number(formData.get("modelProbabilityPct"));
    const stake = Number(formData.get("stake"));
    const notes = String(formData.get("notes") || "");

    try {
      const response = await fetch("/api/analysis/codex-preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          dryRun: true,
          matchId,
          oddsSnapshotId: String(formData.get("oddsSnapshotId") || ""),
          modelProbabilityPct: Number.isFinite(modelProbabilityPct) ? modelProbabilityPct : undefined,
          stake: Number.isFinite(stake) ? stake : 10,
          notes,
        }),
      });
      const payload = await response.json();
      if (!payload.ok) throw new Error(payload.error || "Codex preview failed");
      setResult(payload.data);
    } catch (previewError) {
      setResult(null);
      setError(previewError instanceof Error ? previewError.message : String(previewError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>Codex dry-run 分析</CardTitle>
          <Badge variant="outline">writes:false</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-2">
          <select
            name="oddsSnapshotId"
            defaultValue={defaultOddsId}
            disabled={oddsOptions.length === 0}
            className="h-9 rounded-md border bg-background px-3 text-sm"
          >
            {selectedOptions.length ? (
              selectedOptions.map((snapshot) => (
                <option key={snapshot.id} value={snapshot.id}>
                  {snapshot.bookmaker} · {snapshot.market} · {snapshot.selection}
                  {snapshot.line ? ` ${snapshot.line}` : ""} @ {snapshot.decimalOdds.toFixed(2)}
                </option>
              ))
            ) : (
              <option value="">先录入赔率</option>
            )}
          </select>
          <Input name="modelProbabilityPct" type="number" step="0.1" placeholder="Codex 模型概率，例如 55" />
          <Input name="stake" type="number" step="0.01" defaultValue="10" placeholder="预览金额" />
          <Textarea name="notes" placeholder="Codex 额外判断依据，可空" className="md:col-span-2" />
          <Button type="submit" disabled={loading || oddsOptions.length === 0} className="md:col-span-2">
            {loading ? "预览中..." : "生成 dry-run 草稿"}
          </Button>
        </form>

        {error ? <div className="rounded-md border border-destructive/40 px-3 py-2 text-sm text-destructive">{error}</div> : null}

        {result ? (
          <div className="space-y-3 rounded-md border bg-muted/30 p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-medium">{recommendationLabel(result.analysis.recommendation)}</div>
              <div className="font-mono text-xs text-muted-foreground">
                intent writes {String(result.intentPreview.writes)} · {result.analysis.dataQuality}
              </div>
            </div>
            <div className="grid gap-2 md:grid-cols-4">
              <div>
                <div className="text-xs text-muted-foreground">Market implied</div>
                <div className="font-mono">{pct(result.analysis.marketImpliedProbability)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Fair</div>
                <div className="font-mono">
                  {pct(result.analysis.marketFairProbability)} · {result.analysis.fairOdds.toFixed(2)}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Model</div>
                <div className="font-mono">
                  {result.analysis.modelProbability === undefined ? "-" : pct(result.analysis.modelProbability)}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">EV</div>
                <div className="font-mono">
                  {result.analysis.expectedValue === undefined ? "-" : pct(result.analysis.expectedValue)}
                </div>
              </div>
            </div>
            {result.warnings.length ? (
              <div className="rounded border bg-background px-2 py-1.5 text-xs text-muted-foreground">
                {result.warnings.join(" ")}
              </div>
            ) : null}
            <div className="text-xs text-muted-foreground">
              预览 stake ¥{(result.analysis.stakeCents / 100).toFixed(2)}，状态 {result.intentPreview.intent.status}，
              approval {result.intentPreview.intent.approvalMode}。
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
