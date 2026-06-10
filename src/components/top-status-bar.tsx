import { Badge } from "@/components/ui/badge";
import { MobileNav } from "@/components/mobile-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { getDashboardSummary } from "@/server/queries/dashboard";
import { formatCny } from "@/domain/money";

export async function TopStatusBar() {
  const summary = await getDashboardSummary();
  const codex = summary.portfolios.find((portfolio) => portfolio.id === "codex");
  const openExposure = summary.openBetSlips.reduce((sum, slip) => sum + slip.stakeCents, 0);

  return (
    <header className="shrink-0 border-b bg-background px-4 py-3 md:h-14 md:py-0">
      <div className="flex h-full flex-col gap-2 md:flex-row md:items-center md:justify-between">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Badge variant="outline" className="shrink-0">Codex {formatCny(codex?.allocatedBalanceCents ?? 0)}</Badge>
        <Badge variant="outline" className="shrink-0">敞口 {formatCny(openExposure)}</Badge>
        <Badge variant="outline" className="shrink-0">待执行 {summary.pendingIntents.length}</Badge>
      </div>
      <div className="flex items-center justify-between gap-2 md:justify-end">
        <MobileNav />
        <ThemeToggle />
      </div>
      </div>
    </header>
  );
}
