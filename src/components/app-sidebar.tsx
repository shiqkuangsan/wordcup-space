import Link from "next/link";
import { BadgeDollarSign, ChartSpline, ClipboardList, Goal, Settings, Trophy } from "lucide-react";

const navItems = [
  { href: "/", label: "总览", icon: ChartSpline },
  { href: "/matches", label: "比赛中心", icon: Trophy },
  { href: "/bankroll", label: "资金账本", icon: BadgeDollarSign },
  { href: "/intents", label: "决策队列", icon: ClipboardList },
  { href: "/bets", label: "注单中心", icon: Goal },
  { href: "/settings", label: "设置", icon: Settings },
];

export function AppSidebar() {
  return (
    <aside className="hidden w-64 shrink-0 border-r bg-sidebar/80 p-4 md:block">
      <div className="mb-6 space-y-1">
        <p className="font-mono text-xs text-muted-foreground">wordcup-space</p>
        <h1 className="text-lg font-semibold tracking-normal">世界杯决策工作台</h1>
      </div>
      <nav className="space-y-1">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex h-9 items-center gap-2 rounded-md px-3 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <item.icon className="size-4" />
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
