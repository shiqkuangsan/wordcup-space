"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BadgeDollarSign, Brain, ChartSpline, ClipboardList, Goal, Settings, Trophy } from "lucide-react";

import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "总览", icon: ChartSpline },
  { href: "/matches", label: "比赛中心", icon: Trophy },
  { href: "/predictions", label: "Codex 预测", icon: Brain },
  { href: "/bankroll", label: "资金账本", icon: BadgeDollarSign },
  { href: "/intents", label: "决策队列", icon: ClipboardList },
  { href: "/bets", label: "注单中心", icon: Goal },
  { href: "/settings", label: "设置", icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden h-screen w-64 shrink-0 overflow-y-auto border-r bg-sidebar/80 p-4 md:block">
      <div className="mb-6 space-y-1">
        <p className="font-mono text-xs text-muted-foreground">wordcup-space</p>
        <h1 className="text-lg font-semibold tracking-normal">世界杯决策工作台</h1>
      </div>
      <nav className="space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(`${item.href}/`));

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex h-9 items-center gap-2 rounded-md px-3 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                isActive && "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
              )}
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
