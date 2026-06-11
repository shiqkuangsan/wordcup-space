"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const DEFAULT_INTERVAL_MS = 60_000;

export function MatchesAutoRefresh({
  intervalMs = DEFAULT_INTERVAL_MS,
}: {
  intervalMs?: number;
}) {
  const router = useRouter();
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);

  useEffect(() => {
    const refresh = () => {
      router.refresh();
      setLastRefreshedAt(new Date());
    };
    const intervalId = window.setInterval(refresh, intervalMs);

    return () => window.clearInterval(intervalId);
  }, [intervalMs, router]);

  return (
    <Badge variant="outline" className="gap-1.5">
      <RefreshCw className="size-3" />
      自动刷新 {Math.round(intervalMs / 1000)}s
      {lastRefreshedAt ? (
        <span className="text-muted-foreground">
          · {lastRefreshedAt.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
        </span>
      ) : null}
    </Badge>
  );
}
