"use client";

import Link from "next/link";
import { CheckCircle2, ChevronRight, ExternalLink, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { formatPredictionConfidence, formatPredictionDataMode, formatPredictionStatus } from "@/domain/predictions";

export type PredictionListItem = {
  id: string;
  matchId: string;
  matchTitle: string;
  matchHref?: string;
  kickoffLabel?: string;
  matchStatus?: string;
  predictedBy: string;
  predictedHomeScore: number;
  predictedAwayScore: number;
  confidence: string;
  dataMode: string;
  status: string;
  rationale: string;
  riskNote: string;
  predictedAt: string;
  actualHomeScore?: number | null;
  actualAwayScore?: number | null;
  scoreHit?: boolean | null;
  resultSourceNote?: string | null;
  resultCheckedAt?: string | null;
};

function ScoreBadge({ item }: { item: PredictionListItem }) {
  if (item.scoreHit === true) {
    return <Badge className="gap-1"><CheckCircle2 className="size-3" />比分命中</Badge>;
  }
  if (item.scoreHit === false) {
    return <Badge variant="secondary" className="gap-1"><XCircle className="size-3" />比分未中</Badge>;
  }
  return <Badge variant="outline">待赛果</Badge>;
}

function ScorePanel({
  label,
  score,
}: {
  label: string;
  score: string;
}) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-2xl">{score}</p>
    </div>
  );
}

function DetailDrawerContent({ item }: { item: PredictionListItem }) {
  const actualScore =
    item.actualHomeScore !== null && item.actualHomeScore !== undefined && item.actualAwayScore !== null && item.actualAwayScore !== undefined
      ? `${item.actualHomeScore}-${item.actualAwayScore}`
      : "---";

  return (
    <SheetContent className="w-[min(94vw,720px)] gap-0 overflow-y-auto p-0 sm:max-w-none">
      <SheetHeader className="border-b pr-14">
        <SheetTitle className="text-lg tracking-normal">{item.matchTitle}</SheetTitle>
        <SheetDescription>
          {[item.kickoffLabel, item.matchStatus, formatPredictionStatus(item.status)].filter(Boolean).join(" · ")}
        </SheetDescription>
      </SheetHeader>

      <div className="space-y-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            <ScoreBadge item={item} />
            <Badge variant="outline">{formatPredictionConfidence(item.confidence)}</Badge>
            <Badge variant="outline">{formatPredictionDataMode(item.dataMode)}</Badge>
          </div>
          {item.matchHref ? (
            <Button asChild variant="outline" size="sm">
              <Link href={item.matchHref}>
                <ExternalLink className="size-3.5" />
                比赛详情
              </Link>
            </Button>
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <ScorePanel
            label="预测比分"
            score={`${item.predictedHomeScore}-${item.predictedAwayScore}`}
          />
          <ScorePanel
            label="真实比分"
            score={actualScore}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">预测主体</p>
            <p className="mt-1 text-base font-medium">{item.predictedBy}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">预测时间</p>
            <p className="mt-1 text-base font-medium">{item.predictedAt}</p>
          </div>
        </div>

        <section className="space-y-2">
          <h3 className="text-sm font-medium">预测理由</h3>
          <p className="rounded-md border bg-muted/20 p-3 text-sm leading-6 text-muted-foreground">{item.rationale}</p>
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-medium">主要风险</h3>
          <p className="rounded-md border bg-muted/20 p-3 text-sm leading-6 text-muted-foreground">{item.riskNote}</p>
        </section>

        {item.resultSourceNote ? (
          <section className="space-y-2">
            <h3 className="text-sm font-medium">赛果核对</h3>
            <p className="rounded-md border bg-muted/20 p-3 text-sm leading-6 text-muted-foreground">
              {item.resultSourceNote}
            </p>
          </section>
        ) : null}
      </div>
    </SheetContent>
  );
}

export function PredictionListDrawer({ items }: { items: PredictionListItem[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>预测列表</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-hidden rounded-md border">
          <div className="grid grid-cols-[minmax(180px,1.5fr)_88px_88px_96px_40px] gap-3 border-b bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground max-md:hidden">
            <div>比赛</div>
            <div>预测</div>
            <div>真实</div>
            <div>状态</div>
            <div className="sr-only">操作</div>
          </div>

          {items.map((item) => {
            const actualScore =
              item.actualHomeScore !== null && item.actualHomeScore !== undefined && item.actualAwayScore !== null && item.actualAwayScore !== undefined
                ? `${item.actualHomeScore}-${item.actualAwayScore}`
                : "---";

            return (
              <Sheet key={item.id}>
                <SheetTrigger asChild>
                  <button
                    type="button"
                    className="grid w-full grid-cols-[1fr_auto] items-center gap-3 border-b px-3 py-3 text-left transition-colors last:border-b-0 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:grid-cols-[minmax(180px,1.5fr)_88px_88px_96px_40px]"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium">{item.matchTitle}</div>
                      <div className="mt-1 truncate text-xs text-muted-foreground">
                        {[item.kickoffLabel, item.matchStatus].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                    <div className="hidden font-mono text-sm md:block">
                      {item.predictedHomeScore}-{item.predictedAwayScore}
                    </div>
                    <div className="hidden font-mono text-sm md:block">{actualScore}</div>
                    <div className="hidden md:block">
                      <Badge variant="outline">{formatPredictionStatus(item.status)}</Badge>
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      <span className="font-mono text-sm md:hidden">
                        {item.predictedHomeScore}-{item.predictedAwayScore}
                      </span>
                      <ChevronRight className="size-4 text-muted-foreground" />
                    </div>
                  </button>
                </SheetTrigger>
                <DetailDrawerContent item={item} />
              </Sheet>
            );
          })}

          {items.length === 0 ? (
            <div className="px-3 py-8 text-sm text-muted-foreground">暂无预测记录。</div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
