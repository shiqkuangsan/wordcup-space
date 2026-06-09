import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { getDashboardSummary } from "@/server/queries/dashboard";
import { formatCny } from "@/domain/money";

const mobileLinks = [
  { href: "/", label: "总览" },
  { href: "/matches", label: "比赛" },
  { href: "/bankroll", label: "资金" },
  { href: "/intents", label: "决策" },
  { href: "/bets", label: "注单" },
];

export async function TopStatusBar() {
  const summary = await getDashboardSummary();
  const codex = summary.portfolios.find((portfolio) => portfolio.id === "codex");
  const openExposure = summary.openBetSlips.reduce((sum, slip) => sum + slip.stakeCents, 0);

  return (
    <header className="flex flex-col gap-2 border-b bg-background px-4 py-3 md:h-14 md:flex-row md:items-center md:justify-between md:py-0">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Badge variant="outline" className="shrink-0">Codex {formatCny(codex?.allocatedBalanceCents ?? 0)}</Badge>
        <Badge variant="outline" className="shrink-0">敞口 {formatCny(openExposure)}</Badge>
        <Badge variant="outline" className="shrink-0">待执行 {summary.pendingIntents.length}</Badge>
      </div>
      <div className="flex items-center justify-between gap-2 md:justify-end">
        <nav className="flex gap-2 overflow-x-auto text-sm text-muted-foreground md:hidden">
          {mobileLinks.map((link) => (
            <Link key={link.href} href={link.href} className="shrink-0 hover:text-foreground">
              {link.label}
            </Link>
          ))}
        </nav>
        <ThemeToggle />
      </div>
    </header>
  );
}
