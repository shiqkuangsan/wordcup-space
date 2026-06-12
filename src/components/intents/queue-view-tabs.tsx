"use client";

import { useRouter } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type QueueViewTab = {
  value: string;
  label: string;
  description: string;
  count: number;
  href: string;
};

export function QueueViewTabs({
  activeView,
  tabs,
}: {
  activeView: string;
  tabs: QueueViewTab[];
}) {
  const router = useRouter();

  return (
    <Tabs
      value={activeView}
      className="w-full"
      onValueChange={(value) => {
        const tab = tabs.find((item) => item.value === value);
        if (tab) router.push(tab.href);
      }}
    >
      <TabsList
        aria-label="决策队列视图"
        variant="line"
        className="h-auto w-full justify-start overflow-x-auto rounded-none border-b p-0"
      >
        {tabs.map((tab) => (
          <TabsTrigger
            key={tab.value}
            value={tab.value}
            title={tab.description}
            className="h-10 flex-none rounded-none px-3 py-2"
          >
            <span>{tab.label}</span>
            <span className="font-mono text-xs text-muted-foreground tabular-nums">{tab.count}</span>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
