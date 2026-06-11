import { RefreshCw, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { MatchSyncPanel } from "@/components/matches/sync-panel";
import { OddsSyncPanel } from "@/components/matches/odds-sync-panel";

type SourceSummary = {
  sourceName: string;
  count: number;
  lastSyncedAt?: string | null;
};

export function MatchSyncDrawer({
  summaries,
  visibleSource,
}: {
  summaries: SourceSummary[];
  visibleSource: string;
}) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <SlidersHorizontal className="size-4" />
          同步
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[min(92vw,520px)] gap-0 overflow-y-auto p-0 sm:max-w-none">
        <SheetHeader className="border-b">
          <SheetTitle className="flex items-center gap-2">
            <RefreshCw className="size-4" />
            同步中心
          </SheetTitle>
          <SheetDescription>赛程和参考赔率同步；列表仍会每 60 秒自动刷新。</SheetDescription>
        </SheetHeader>
        <div className="space-y-4 p-4">
          <MatchSyncPanel summaries={summaries} visibleSource={visibleSource} />
          <OddsSyncPanel />
        </div>
      </SheetContent>
    </Sheet>
  );
}
