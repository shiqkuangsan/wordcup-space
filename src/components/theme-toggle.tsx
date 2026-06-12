"use client";

import { SunMoon } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <Button
      aria-label="切换主题"
      size="icon"
      variant="ghost"
      className="hover:border-border hover:bg-muted hover:text-foreground hover:shadow-sm"
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      <SunMoon className="size-4 transition-transform group-hover/button:rotate-12" />
    </Button>
  );
}
