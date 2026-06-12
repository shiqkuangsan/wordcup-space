"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const mobileLinks = [
  { href: "/", label: "总览" },
  { href: "/matches", label: "比赛" },
  { href: "/predictions", label: "预测" },
  { href: "/bankroll", label: "资金" },
  { href: "/intents", label: "决策" },
  { href: "/bets", label: "注单" },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 overflow-x-auto text-sm md:hidden">
      {mobileLinks.map((link) => {
        const isActive = pathname === link.href || (link.href !== "/" && pathname.startsWith(`${link.href}/`));

        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "h-8 shrink-0 rounded-md px-2.5 leading-8 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
              isActive && "bg-accent text-accent-foreground font-medium"
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
